/* ===== Main App (navigation + test UI) — Enhanced with Mode Presets ===== */
(function (global) {
    'use strict';

    function $(sel, ctx) { return (ctx || document).querySelector(sel); }

    function fmtTime(sec) {
        sec = Math.max(0, Math.floor(sec));
        var m = Math.floor(sec / 60);
        var r = sec % 60;
        return (m < 10 ? '0' + m : m) + ':' + (r < 10 ? '0' + r : r);
    }

    // ===== Preference Storage =====
    var showPlusPref = true; // default on
    var showPreviewPref = true; // default on
    var verticalPref = false;   // default off (horizontal)
    var soundPref = false;   // default off
    var typedAnswer = '';   // current digit shown in answer display

    try {
        var stored = JSON.parse(localStorage.getItem('kraepelinPrefs')) || {};
        if (typeof stored.showPlus === 'boolean') showPlusPref = stored.showPlus;
        if (typeof stored.showPreview === 'boolean') showPreviewPref = stored.showPreview;
        if (typeof stored.vertical === 'boolean') verticalPref = stored.vertical;
        if (typeof stored.sound === 'boolean') soundPref = stored.sound;
    } catch (e) { }

    function savePrefs() {
        localStorage.setItem('kraepelinPrefs', JSON.stringify({
            showPlus: showPlusPref,
            showPreview: showPreviewPref,
            vertical: verticalPref,
            sound: soundPref
        }));
    }

    function buildQuestionHTML(q, i, prevNum, nextNum, typedAnswer) {
        var pair, pairClass;
        if (verticalPref) {
            pairClass = 'q-pair q-pair-vertical';
            pair = '<span class="q-pair-top">' + q.left + '</span>' +
                (showPlusPref ? '<span class="q-pair-op">+</span>' : '') +
                '<span class="q-pair-bottom">' + q.right + '</span>';
        } else {
            pairClass = 'q-pair';
            pair = showPlusPref
                ? q.left + ' + ' + q.right
                : q.left + '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' + q.right;
        }
        return '<div class="q-row q-row-enter" data-i="' + i + '"' + (verticalPref ? ' data-layout="vertical"' : '') + '>' +
            '<div class="q-sequence">' +
            (prevNum !== null ? '<div class="q-preview prev">' + prevNum + '</div>' : '<div class="q-preview prev empty"></div>') +
            '<div class="' + pairClass + '">' + pair + '</div>' +
            (nextNum !== null ? '<div class="q-preview next">' + nextNum + '</div>' : '<div class="q-preview next empty"></div>') +
            '</div>' +
            '<div class="q-answer">' +
            '<span class="q-num">Q' + (i + 1) + '</span>' +
            '<span class="q-answer-display">' + (typedAnswer || '') + '</span>' +
            '</div>' +
            '<div class="q-feedback"></div>' +
            '</div>';
    }

    // Sound wrapper — only plays when soundPref is true
    function playSound(type) {
        if (!soundPref) return;
        if (typeof AudioEngine !== 'undefined' && AudioEngine.play) {
            AudioEngine.play(type);
        }
    }

    // ===== Track Lari (streak) — visual badge under the timer =====
    // Milestones: 5, 10, 15, ... consecutive correct answers.
    function updateStreakBadge(engine, milestone) {
        var badge = $('#streak-badge');
        if (!badge) return;
        var current = engine.streak || 0;
        badge.textContent = current + 'x';
        badge.classList.toggle('show', current > 0);
        badge.classList.toggle('milestone', current > 0 && current % 10 === 0);
        if (milestone) {
            badge.classList.add('flash');
            setTimeout(function () { badge.classList.remove('flash'); }, 600);
        }
    }

    function resetStreakUI() {
        var badge = $('#streak-badge');
        if (badge) {
            badge.textContent = '0x';
            badge.classList.remove('show', 'flash');
        }
    }

    function bindTimePicker(engine) {
        var buttonGroup = $('#time-presets');
        var custom = $('#cfg-time-custom');
        var customWrapper = $('#custom-time-input');
        if (!buttonGroup) return;

        var buttons = buttonGroup.querySelectorAll('.time-btn');
        if (!buttons.length) return;

        function setPreset(mins) {
            if (engine) engine.setTime(mins * 60);
        }

        // initialize default (1 minute)
        var defaultBtn = buttonGroup.querySelector('.time-btn[data-value="1"]');
        if (defaultBtn) {
            defaultBtn.classList.add('active');
            setPreset(1);
        }

        buttons.forEach(function (btn) {
            btn.addEventListener('click', function () {
                var v = btn.getAttribute('data-value');
                buttons.forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');

                if (v === 'custom') {
                    customWrapper.classList.remove('hidden');
                    custom.focus();
                } else {
                    customWrapper.classList.add('hidden');
                    setPreset(parseInt(v, 10) || 1);
                }
            });
        });

        custom.addEventListener('input', function () {
            var mins = parseInt(custom.value, 10);
            if (isNaN(mins) || mins < 1) mins = 1;
            if (mins > 240) mins = 240;
            custom.value = mins;
            setPreset(mins);
        });
    }

    // Mode picker: buttons auto-fill time and maxErrors fields
    function bindModePicker() {
        var modeButtons = document.querySelectorAll('.mode-card');
        var modeInput = $('#cfg-mode');
        if (!modeButtons.length || !modeInput) return;

        // Mode presets: { name, timeInSeconds, maxErrors, description }
        var MODE_PRESETS = {
            standard: { time: 60, maxErrors: 0, desc: 'Latihan standar 1 menit tanpa batas kesalahan.' },
            sprint: { time: 60, maxErrors: 0, desc: 'Cek kecepatan & akurasi — 1 menit waktu terbatas.' },
            endurance: { time: 1800, maxErrors: 0, desc: 'Latihan ketahanan 30 menit untuk stamina.' },
            target: { time: 60, maxErrors: 5, desc: 'Berhenti otomatis jika salah 5 kali.' }
        };

        function applyMode(mode) {
            var preset = MODE_PRESETS[mode] || MODE_PRESETS.standard;
            modeInput.value = mode;

            if (engine) engine.setTime(preset.time);

            var customPanel = $('#custom-panel');
            if (customPanel) customPanel.classList.add('hidden');
            var customTime = $('#custom-time-input');
            var customErrors = $('#custom-errors-input');
            var customBpm = $('#custom-bpm-input');
            if (customTime) customTime.value = Math.floor(preset.time / 60);
            if (customErrors) customErrors.value = preset.maxErrors;
            if (customBpm) customBpm.value = '';
        }

        modeButtons.forEach(function (btn) {
            btn.addEventListener('click', function () {
                var mode = btn.getAttribute('data-mode');
                modeButtons.forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');
                applyMode(mode);
            });
        });

        var toggle = $('#toggle-custom');
        var panel = $('#custom-panel');
        var closeBtn = $('#close-custom');
        if (toggle && panel) toggle.addEventListener('click', function () { panel.classList.toggle('hidden'); });
        if (closeBtn && panel) closeBtn.addEventListener('click', function () { panel.classList.add('hidden'); });

        // Initialize with standard mode
        applyMode('standard');
    }

    function updateProgress(engine) {
        var bar = $('#progress-bar');
        if (bar && engine.state.time) {
            var timePerc = (engine.elapsed / (engine.state.time * 1000)) * 100;
            bar.style.width = Math.min(100, timePerc) + '%';
        }
        var sd = $('#stat-done');
        if (sd) sd.textContent = engine.index || 0;
        var sc = $('#stat-correct');
        if (sc) sc.textContent = engine.correctCount || 0;
        var sw = $('#stat-wrong');
        if (sw) sw.textContent = engine.wrongCount || 0;
    }

    function renderCurrentQuestion(engine) {
        var container = $('#question-list');
        if (!container) return;
        var i = engine.index || 0;
        var q = engine.questions[i];
        if (!q) return;
        var prevNum = null;
        var nextNum = null;
        if (i > 0) {
            prevNum = engine.questions[i - 1].right;
        }
        if (i < engine.questions.length - 1) {
            nextNum = engine.questions[i + 1].right;
        } else if (engine.peekNextRight) {
            nextNum = engine.peekNextRight();
        }
        var typedAnswer = engine.answers[i] ? String(engine.answers[i]) : '';
        container.innerHTML = buildQuestionHTML(q, i, showPreviewPref ? prevNum : null, showPreviewPref ? nextNum : null, typedAnswer);
    }

    function bindQuestionInputs(engine) {
        document.addEventListener('keydown', function (e) {
            if (engine.ended) return;
            if (e.key >= '0' && e.key <= '9') {
                e.preventDefault();
                var row = document.querySelector('.q-row:not(.locked)');
                if (!row) return;
                if (row.classList.contains('locked')) return;
                var i = parseInt(row.getAttribute('data-i'), 10);
                typedAnswer = e.key;
                var v = parseInt(e.key, 10);
                engine.answers[i] = v;
                var display = row.querySelector('.q-answer-display');
                if (display) display.textContent = typedAnswer;
                row.classList.add('answered', 'locked');

                if (v === engine.questions[i].answer) {
                    engine.correctCount = (engine.correctCount || 0) + 1;
                    var st = engine.recordStreak(true);
                    playSound('correct');
                    if (st.big) playSound('milestone');
                    updateStreakBadge(engine, st.hit);
                } else {
                    engine.wrongCount = (engine.wrongCount || 0) + 1;
                    playSound('wrong');
                    engine.recordStreak(false);
                    updateStreakBadge(engine, false);
                }

                engine.recordAnswer(i, v);
                if (engine.ended) return;
                engine.index = i + 1;
                engine.addNextQuestion();
                renderCurrentQuestion(engine);
                updateProgress(engine);
            }
        });
    }

    function bindKeys(engine) {
        document.addEventListener('keydown', function (e) {
            if (engine.ended) return;
            if (e.key === 'Enter') {
                var submit = $('#submit-btn');
                if (submit) submit.click();
            }
        });
    }

    /* ===== Custom Confirmation Modal (replaces browser confirm()) ===== */
    function ConfirmModal() {
        var overlay = $('#confirm-modal-box');
        var okBtn = $('#confirm-modal-ok');
        var cancelBtn = $('#confirm-modal-cancel');
        var resolve = null;
        var bound = false;

        function close() {
            if (!overlay) return;
            overlay.classList.remove('show');
            document.body.style.overflow = '';
            if (resolve) { resolve(false); resolve = null; }
        }

        function open() {
            if (!overlay) return;
            overlay.classList.add('show');
            document.body.style.overflow = 'hidden';
            if (okBtn) okBtn.focus();
        }

        function onKey(e) {
            if (e.key === 'Escape') { close(); }
        }

        function ensureBound() {
            if (bound) return;
            bound = true;
            if (overlay) {
                overlay.addEventListener('click', function (e) {
                    if (e.target === overlay) close();
                });
            }
            if (cancelBtn) cancelBtn.addEventListener('click', close);
            if (okBtn) okBtn.addEventListener('click', function () {
                if (resolve) { resolve(true); resolve = null; }
                close();
            });
            document.addEventListener('keydown', onKey);
        }

        return {
            show: function () {
                ensureBound();
                return new Promise(function (resolveFn) {
                    resolve = resolveFn;
                    open();
                });
            }
        };
    }

    var engine = null;

    function initTesPage() {
        var urlParams = new URLSearchParams(window.location.search);
        var type = urlParams.get('type') || 'kraepelin';
        var duration = parseInt(urlParams.get('duration')) || 60;
        var maxErrors = parseInt(urlParams.get('maxErrors')) || 0;
        var bpm = parseInt(urlParams.get('bpm')) || 0;

        engine = new TestEngine();
        engine.init(type, maxErrors);
        engine.setTime(duration);
        engine.correctCount = 0;
        engine.wrongCount = 0;
        engine.streak = 0;
        engine.bestStreak = 0;
        resetStreakUI();

        var testInfo = $('#test-info');
        if (testInfo) testInfo.textContent = 'Latihan: ' + (type === 'kraepelin' ? 'Kraepelin' : 'Pauli');

        renderCurrentQuestion(engine);
        updateProgress(engine);

        engine.start(
            function (sec, remaining) {
                var td = $('#timer-display');
                if (td) td.textContent = fmtTime(sec);
                updateProgress(engine);
            },
            function (result) {
                var td = $('#timer-display');
                if (td) td.textContent = '00:00';
                playSound('end');
                window.location.href = 'hasil.html';
            }
        );

        if (bpm > 0 && typeof AudioEngine !== 'undefined') {
            AudioEngine.startMetronome(bpm);
        }

        bindQuestionInputs(engine);
        bindKeys(engine);

        var submitBtn = $('#submit-btn');
        if (submitBtn) submitBtn.addEventListener('click', function () {
            if (submitBtn.disabled) return;
            submitBtn.disabled = true;
            var modal = ConfirmModal();
            modal.show().then(function (confirmed) {
                submitBtn.disabled = false;
                if (confirmed) {
                    engine.submitAnswers();
                    window.location.href = 'hasil.html';
                }
            });
        });

        var endBtn = $('#end-btn');
        if (endBtn) endBtn.addEventListener('click', function () {
            if (endBtn.disabled) return;
            endBtn.disabled = true;
            var modal = ConfirmModal();
            modal.show().then(function (confirmed) {
                endBtn.disabled = false;
                if (confirmed) {
                    engine.endEarly();
                    window.location.href = 'hasil.html';
                }
            });
        });
    }

    function setup() {
        if (window.location.pathname.endsWith('tes.html')) {
            initTesPage();
            return;
        }

        // Restore preference toggles from stored values
        var prefShowPlusEl = document.getElementById('pref-show-plus');
        if (prefShowPlusEl) prefShowPlusEl.checked = showPlusPref;
        var prefShowPreviewEl = document.getElementById('pref-show-preview');
        if (prefShowPreviewEl) prefShowPreviewEl.checked = showPreviewPref;
        var prefVerticalEl = document.getElementById('pref-vertical');
        if (prefVerticalEl) prefVerticalEl.checked = verticalPref;
        var prefSoundEl = document.getElementById('pref-sound');
        if (prefSoundEl) prefSoundEl.checked = soundPref;

        // Listen for changes on the toggles and persist them
        if (prefShowPlusEl) {
            prefShowPlusEl.addEventListener('change', function () {
                showPlusPref = prefShowPlusEl.checked;
                savePrefs();
            });
        }
        if (prefShowPreviewEl) {
            prefShowPreviewEl.addEventListener('change', function () {
                showPreviewPref = prefShowPreviewEl.checked;
                savePrefs();
            });
        }
        if (prefVerticalEl) {
            prefVerticalEl.addEventListener('change', function () {
                verticalPref = prefVerticalEl.checked;
                savePrefs();
            });
        }
        if (prefSoundEl) {
            prefSoundEl.addEventListener('change', function () {
                soundPref = prefSoundEl.checked;
                savePrefs();
            });
        }

        var type = (window.__TEST_TYPE || 'kraepelin').toString();
        engine = new TestEngine();
        engine.init(type);
        bindTimePicker(engine);
        // Wait for DOM to be ready before binding mode picker
        setTimeout(bindModePicker, 0);

        var startBtn = $('#start-btn');
        if (startBtn) {
            startBtn.addEventListener('click', function () {
                var mode = $('#cfg-mode') ? $('#cfg-mode').value : 'standard';
                var isCustom = !$('#custom-panel').classList.contains('hidden');
                var modeMaxErrors = mode === 'target' ? 5 : 0;
                var maxErrors = isCustom && $('#custom-errors-input') ? $('#custom-errors-input').value : modeMaxErrors;
                var bpm = isCustom && $('#custom-bpm-input') ? $('#custom-bpm-input').value : 0;
                var customMinutes = isCustom && $('#custom-time-input') ? parseInt($('#custom-time-input').value, 10) : 0;
                if (isCustom) {
                    if (!customMinutes || customMinutes < 1 || customMinutes > 240) {
                        alert('Masukkan waktu kustom antara 1 sampai 240 menit.');
                        return;
                    }
                    engine.setTime(customMinutes * 60);
                }
                var duration = engine.state.time;

                window.location.href = 'tes.html?type=' + type +
                    '&duration=' + duration +
                    '&maxErrors=' + maxErrors +
                    '&bpm=' + bpm +
                    '&mode=' + mode;
            });
        }
    }

    document.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-goto]');
        if (!btn) return;
        e.preventDefault();
        var href = btn.getAttribute('data-goto');
        if (href) window.location.href = href;
    });

    /* ===== Scroll Reveal =====
     * Cards in "Memahami Perbedaan Tes" fade in & slide up as the user scrolls
     * into view. Staggered so they appear one after another, not all at once.
     * No-op when the section is already visible (e.g. above the fold). */
    function initScrollReveal() {
        var grid = document.querySelector('.def-grid');
        if (!grid) return;
        var items = grid.querySelectorAll(':scope > .def-item');
        if (!items.length) return;

        items.forEach(function (el, i) {
            el.style.setProperty('--reveal-delay', (i * 110) + 'ms');
        });

        if (!('IntersectionObserver' in window)) {
            items.forEach(function (el) { el.classList.add('in-view'); });
            return;
        }

        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in-view');
                    io.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

        items.forEach(function (el) { io.observe(el); });
    }

    document.addEventListener('DOMContentLoaded', function () {
        setup();
        // Scroll reveal runs on every page that has a ".def-grid" (the
        // "Memahami Perbedaan Tes" cards), not just the homepage.
        initScrollReveal();
    });
})(typeof window !== 'undefined' ? window : globalThis);
