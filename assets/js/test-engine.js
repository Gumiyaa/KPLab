/* ===== Test Engine Kraepelin & Pauli — Enhanced ===== */
(function (global) {
    'use strict';

    var TEST_CONFIG = {
        kraepelin: {
            type: 'kraepelin',
            name: 'Tes Kraepelin',
            genInterval: [2, 9],
            time: 60,
            totalQuestions: 30,
            columns: 1,
            seedStart: 1,
            pattern: function () { return 0; },
        },
        pauli: {
            type: 'pauli',
            name: 'Tes Pauli',
            genInterval: [3, 7],
            time: 45,
            totalQuestions: 30,
            columns: 1,
            seedStart: 2,
            pattern: function () { return 0; },
        }
    };

    function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

    function Session() {
        this.data = null;
        try { this.load(); } catch (e) { }
    }
    Session.prototype.load = function () {
        var s = sessionStorage.getItem('kpp_session');
        if (!s) return;
        try { this.data = JSON.parse(s); } catch (e) { this.data = null; }
    };
    Session.prototype.save = function () {
        try { sessionStorage.setItem('kpp_session', JSON.stringify(this.data)); } catch (e) { }
    };
    Session.prototype.reset = function () { this.data = null; this.save(); };

    function TestEngine(opts) {
        this.opts = opts || {};
        this.session = new Session();
        this.state = null;
        this.questions = [];
        this.answers = [];
        this.answerTimestamps = [];
        this.index = 0;
        this.timer = null;
        this.ended = false;
        this.startTime = null;
        this.onTick = function () { };
        this.onEnd = function () { };
        this.maxErrors = 0; // 0 = unlimited, otherwise max allowed wrong before stopping
        this.pendingRight = null; // next "right" value reserved by peekNextRight
        this.streak = 0; // consecutive correct answers in the current run
        this.bestStreak = 0; // longest streak achieved this session
    }

    TestEngine.prototype.init = function (cfgKey, maxErrors) {
        var cfg = TEST_CONFIG[cfgKey] || TEST_CONFIG.kraepelin;
        this.state = JSON.parse(JSON.stringify(cfg)); // clone
        this.questions = [];
        this.answers = [];
        this.answerTimestamps = [];
        this.index = 0;
        this.ended = false;
        this.lastRight = null;
        this.maxErrors = parseInt(maxErrors, 10) || 0;
        this.streak = 0;
        this.bestStreak = 0;
        this.addNextQuestion();
    };

    TestEngine.prototype.setTime = function (seconds) {
        if (!this.state) return;
        var s = parseInt(seconds, 10);
        if (isNaN(s) || s <= 0) s = this.state.time;
        this.state.time = s;
    };

    TestEngine.prototype.addNextQuestion = function () {
        var cfg = this.state;
        var left;
        if (this.lastRight === null) {
            left = rnd(cfg.genInterval[0], cfg.genInterval[1]);
        } else {
            left = this.lastRight;
        }
        var right = (this.pendingRight !== null) ? this.pendingRight : rnd(cfg.genInterval[0], cfg.genInterval[1]);
        this.pendingRight = null;
        var answer = (left + right) % 10;
        this.questions.push({ left: left, right: right, answer: answer });
        this.lastRight = right;
    };

    // Peek the "right" value that will be used by the next generated question,
    // without pushing a question onto the array. The value is remembered so
    // addNextQuestion() produces the exact same number later. This keeps the
    // preview perfectly in sync with the real sequence and does not affect
    // scoring, timer, or progress.
    TestEngine.prototype.peekNextRight = function () {
        if (this.pendingRight !== null) return this.pendingRight;
        this.pendingRight = rnd(this.state.genInterval[0], this.state.genInterval[1]);
        return this.pendingRight;
    };

    TestEngine.prototype.start = function (onTick, onEnd) {
        this.onTick = onTick || function () { };
        this.onEnd = onEnd || function () { };
        var cfg = this.state;
        var self = this;
        var total = cfg.time * 1000;
        this.elapsed = 0;
        this.startTime = Date.now();
        var remaining = total;
        clearInterval(this.timer);
        this.timer = setInterval(function () {
            remaining -= 100;
            self.elapsed = total - remaining;
            if (remaining <= 0) {
                remaining = 0;
                self.elapsed = total;
                self.endTimerExhausted();
                return;
            }
            self.onTick(Math.max(0, Math.ceil(remaining / 1000)), Math.max(0, cfg.totalQuestions - self.index));
        }, 100);
    };

    TestEngine.prototype.recordAnswer = function (i, v) {
        this.answers[i] = v;
        if (this.answerTimestamps.length <= i) {
            this.answerTimestamps.push(this.elapsed);
        } else {
            this.answerTimestamps[i] = this.elapsed;
        }

        // Check if maxErrors limit reached
        if (this.maxErrors > 0) {
            var wrongTotal = 0;
            for (var k = 0; k <= i; k++) {
                if (typeof this.answers[k] === 'number' && this.answers[k] !== this.questions[k].answer) {
                    wrongTotal++;
                }
            }
            if (wrongTotal >= this.maxErrors) {
                // Trigger early stop due to error limit exceeded
                var self = this;
                setTimeout(function () {
                    self.endActive(true, 'Batas maksimal kesalahan (' + self.maxErrors + 'x) tercapai.');
                }, 100);
            }
        }
    };

    // Track the running streak of consecutive correct answers.
    // Returns { hit: boolean, big: boolean } — big=true when streak is a multiple of 10.
    TestEngine.prototype.recordStreak = function (isCorrect) {
        if (isCorrect) {
            this.streak = (this.streak || 0) + 1;
            if (this.streak > (this.bestStreak || 0)) this.bestStreak = this.streak;
            var big = (this.streak % 10 === 0);
            return { hit: [5, 10, 15, 20, 25, 30].indexOf(this.streak) !== -1, big: big };
        }
        this.streak = 0;
        return { hit: false, big: false };
    };

    TestEngine.prototype.submitAnswers = function () { this.endEarly(); };
    TestEngine.prototype.endEarly = function () { this.endActive(true, 'Diakhiri secara manual/waktu habis.'); };

    TestEngine.prototype.endActive = function (early, reason) {
        if (this.ended) return;
        this.ended = true;
        clearInterval(this.timer);
        if (typeof AudioEngine !== 'undefined' && AudioEngine.stopMetronome) {
            AudioEngine.stopMetronome();
        }
        var total = this.questions.length;
        var answered = 0, correct = 0;
        for (var i = 0; i < total; i++) {
            var v = this.answers[i];
            if (typeof v === 'number') {
                answered++;
                if (v === this.questions[i].answer) correct++;
            }
        }
        var wrong = answered - correct;
        var unanswered = total - answered;
        var acc = total ? Math.round(correct / total * 100) : 0;
        var result = {
            type: this.state.type,
            name: this.state.name,
            duration: this.elapsed,
            total: total,
            correct: correct,
            wrong: wrong,
            unanswered: unanswered,
            accuracy: acc,
            answered: answered,
            timestamps: this.answerTimestamps.slice(0, total),
            answersCount: answered,
            finishedAt: new Date().toISOString(),
            finished: true,
            early: !!early,
            stopReason: reason || '',
            streak: this.streak || 0,
            bestStreak: this.bestStreak || 0
        };
        this.session.data = result;
        this.session.save();
        this.onEnd(result);
    };
    TestEngine.prototype.endTimerExhausted = function () { this.endActive(true, 'Waktu latihan habis.'); };

    global.TEST_CONFIG = TEST_CONFIG;
    global.TestEngine = TestEngine;
})(typeof window !== 'undefined' ? window : globalThis);
