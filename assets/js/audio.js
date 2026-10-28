// Audio feedback and metronome using Web Audio API.
const AudioEngine = {
    ctx: null,
    metronomeTimer: null,
    isMuted: false,
    faaah: null,
    faaahLoading: null,
    pendingMilestone: false,

    init: function () {
        if (this.ctx) {
            if (this.ctx.state === 'suspended') this.ctx.resume();
            return;
        }
        var AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        this.ctx = new AudioCtx();
        this.loadFaaah();
    },

    loadFaaah: function () {
        if (this.faaah || this.faaahLoading) return;
        this.faaahLoading = new Audio('assets/audio/faaah.mp3');
        this.faaahLoading.preload = 'auto';
        this.faaahLoading.load();
        this.faaahLoading.addEventListener('canplaythrough', function () {
            AudioEngine.faaah = AudioEngine.faaahLoading;
            if (AudioEngine.pendingMilestone) {
                AudioEngine.pendingMilestone = false;
                AudioEngine.play('milestone');
            }
        }, { once: true });
        this.faaahLoading.addEventListener('error', function () {
            AudioEngine.faaahLoading = null;
        }, { once: true });
    },

    play: function (type) {
        if (this.isMuted) return;
        this.init();
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        if (type === 'milestone' && !this.faaah) {
            this.pendingMilestone = true;
            return;
        }
        if (type === 'milestone' && this.faaah) {
            this.faaah.currentTime = 0;
            var result = this.faaah.play();
            if (result && result.catch) result.catch(function () { });
            return;
        }

        var osc = this.ctx.createOscillator();
        var gain = this.ctx.createGain();
        var now = this.ctx.currentTime;
        osc.connect(gain);
        gain.connect(this.ctx.destination);

        if (type === 'correct') {
            osc.frequency.value = 880;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.22, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'wrong') {
            osc.frequency.value = 220;
            osc.type = 'square';
            gain.gain.setValueAtTime(0.22, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
        } else if (type === 'tick') {
            osc.frequency.value = 1200;
            osc.type = 'triangle';
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
            osc.start(now);
            osc.stop(now + 0.04);
        }
    },

    startMetronome: function (bpm) {
        this.stopMetronome();
        if (!bpm || bpm <= 0) return;
        var intervalMs = (60 / bpm) * 1000;
        var self = this;
        this.play('tick');
        this.metronomeTimer = setInterval(function () { self.play('tick'); }, intervalMs);
    },

    stopMetronome: function () {
        if (this.metronomeTimer) {
            clearInterval(this.metronomeTimer);
            this.metronomeTimer = null;
        }
    }
};
global.AudioEngine = AudioEngine;
