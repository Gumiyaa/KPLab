/* ===== Results Renderer ===== */
(function (global) {
    'use strict';

    var COLORS = {
        primary: '#E06262',
        coral: '#E06262',
        mint: '#2E8F7B',
        peach: '#D99A5C',
        text: '#2E2A26',
        textMuted: '#7A756F',
        correct: '#2E8F7B',
        wrong: '#E06262',
        muted: '#7A756F'
    };

    function fmtDuration(ms) {
        var s = Math.floor(ms / 1000);
        var m = Math.floor(s / 60);
        var r = s % 60;
        return m + ':' + (r < 10 ? '0' + r : r);
    }

    function buildSummary(r) {
        var reason = r.early ? 'diakhiri ' + (r.duration === 0 ? 'oleh habis waktu' : 'secara manual') : 'selesai';
        var out = 'Latihan ' + reason + '. Dari ' + r.total + ' soal, ' + r.correct + ' dijawab benar, ' + r.wrong + ' dijawab salah, dan ' + r.unanswered + ' tidak dijawab.';

        // analisis kecepatan
        var secPer = r.elapsed ? (r.elapsed / r.total) : 0;
        if (secPer <= 2) out += ' Kecepatan cepat.';
        else if (secPer <= 5) out += ' Kecepatan stabil.';
        else out += ' Kecepatan lambat.';

        // analisis konsistensi dari timestamps jawaban
        if (r.timestamps && r.timestamps.length > 2) {
            var speeds = [];
            for (var i = 1; i < r.timestamps.length; i++) {
                speeds.push(r.timestamps[i] - r.timestamps[i - 1]);
            }
            var mean = speeds.reduce(function (a, b) { return a + b; }, 0) / speeds.length;
            var variance = speeds.reduce(function (a, b) { return a + Math.pow(b - mean, 2); }, 0) / speeds.length;
            var cv = mean ? Math.sqrt(variance) / mean : 0;
            if (cv < 0.5) out += ' Ritme jawaban sangat konsisten.';
            else if (cv < 1) out += ' Ritme jawaban cukup konsisten.';
            else out += ' Ritme jawaban tidak stabil (naik-turun).';
        }

        // Analisis streak (track lari)
        var best = r.bestStreak || 0;
        var cur = r.streak || 0;
        if (best >= 15) out += ' ' + best + 'x lari dalam satu run. Hebat!';
        else if (best >= 10) out += ' ' + best + 'x lari dalam satu run. Bagus!';
        else if (best >= 5) out += ' ' + best + 'x lari dalam satu run. Lumayan!';
        else if (best >= 1) out += ' Streak tertinggi ' + best + 'x.';

        return out;
    }

    var Results = {
        render: function () {
            var data = null;
            try { data = JSON.parse(sessionStorage.getItem('kpp_session')); } catch (e) { data = null; }
            var empty = document.getElementById('result-empty');
            var dataEl = document.getElementById('result-data');
            if (!data || !data.finished) {
                if (empty) empty.classList.remove('hidden');
                if (dataEl) dataEl.classList.add('hidden');
                return;
            }
            if (empty) empty.classList.add('hidden');
            if (dataEl) dataEl.classList.remove('hidden');

            var typeEl = document.getElementById('r-type');
            if (typeEl) typeEl.textContent = data.name;
            var durEl = document.getElementById('r-duration');
            if (durEl) durEl.textContent = fmtDuration(data.duration || 0) + ' detik';

            this.setText('r-total', data.total);
            this.setText('r-correct', data.correct);
            this.setText('r-wrong', data.wrong);
            this.setText('r-unanswered', data.unanswered);
            this.setText('r-accuracy', data.accuracy + '%');

            var speed = data.total ? Math.round(data.total / ((data.duration || 1) / 60) * 10) / 10 : 0;
            this.setText('r-speed', speed);

            this.setText('r-streak', data.bestStreak || 0);

            var sumEl = document.getElementById('r-summary');
            if (sumEl) sumEl.innerHTML = buildSummary(data);

            this.renderChart(data);

            var retry = document.getElementById('retry-btn');
            if (retry) retry.onclick = function () { Results.retry(); };
        },
        renderChart: function (data) {
            var canvas = document.getElementById('performanceChart');
            if (!canvas) return;

            new Chart(canvas.getContext('2d'), {
                type: 'line',
                data: {
                    labels: ['Benar', 'Salah', 'Tidak Dijawab'],
                    datasets: [{
                        label: 'Jumlah soal',
                        data: [data.correct, data.wrong, data.unanswered],
                        borderColor: COLORS.primary,
                        backgroundColor: 'rgba(224, 98, 98, 0.12)',
                        borderWidth: 3,
                        tension: 0.3,
                        fill: true,
                        pointBackgroundColor: COLORS.primary,
                        pointRadius: 7,
                        pointBorderColor: '#FDF9F4',
                        pointBorderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: { beginAtZero: true, ticks: { precision: 0 } }
                    }
                }
            });
        },
        setText: function (id, val) {
            var el = document.getElementById(id);
            if (el) el.textContent = val;
        },
        retry: function () {
            var data = null;
            try { data = JSON.parse(sessionStorage.getItem('kpp_session')); } catch (e) { data = null; }
            if (data && data.type) {
                window.location.href = data.type === 'kraepelin' ? 'kraepelin.html' : 'pauli.html';
            } else {
                window.location.href = 'index.html';
            }
        }
    };

    global.Results = Results;
})(typeof window !== 'undefined' ? window : globalThis);
