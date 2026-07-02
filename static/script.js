document.addEventListener('DOMContentLoaded', function () {
    const fileInput = document.getElementById('fileInput');
    const preview = document.getElementById('preview');
    const uploadBtn = document.getElementById('uploadBtn');
    const resultDiv = document.getElementById('result');
    const diagnosisText = document.getElementById('diagnosis-text');
    const warningDiv = document.getElementById('warning');
    const linesSpan = document.getElementById('lines');
    const spotsSpan = document.getElementById('spots');
    const confidenceSpan = document.getElementById('confidence');
    const sectorChart = document.getElementById('sector-chart');
    const eyeSide = document.getElementById('eyeSide');

    // Кольца
    const stomachSpan = document.getElementById('stomach-lines');
    const intestineSpan = document.getElementById('intestine-lines');
    const outerSpan = document.getElementById('outer-lines');

    fileInput.addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (ev) {
                preview.src = ev.target.result;
                preview.style.display = 'block';
                resultDiv.style.display = 'none';
                warningDiv.style.display = 'none';
            };
            reader.readAsDataURL(file);
        }
    });

    uploadBtn.addEventListener('click', function () {
        const file = fileInput.files[0];
        if (!file) {
            alert('Пожалуйста, выберите фото!');
            return;
        }

        uploadBtn.disabled = true;
        uploadBtn.textContent = '⏳ Анализируем...';

        const formData = new FormData();
        formData.append('file', file);
        formData.append('eye_side', eyeSide.value);

        fetch('/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(data => { throw new Error(data.error || 'Ошибка сервера'); });
            }
            return response.json();
        })
        .then(data => {
            if (data.error) {
                alert('Ошибка: ' + data.error);
                return;
            }

            // Основной диагноз
            diagnosisText.textContent = data.diagnosis;

            // Предупреждение (если есть)
            if (data.warning) {
                warningDiv.textContent = '⚠️ ' + data.warning;
                warningDiv.style.display = 'block';
            } else {
                warningDiv.style.display = 'none';
            }

            // Кольца
            stomachSpan.textContent = data.stomach_lines || 0;
            intestineSpan.textContent = data.intestine_lines || 0;
            // Внешнее кольцо — сумма линий во всех секторах
            let outerTotal = 0;
            if (data.sector_counts) {
                outerTotal = data.sector_counts.reduce((a, b) => a + b, 0);
            }
            outerSpan.textContent = outerTotal;

            // Старые поля
            linesSpan.textContent = data.lines_count || 0;
            spotsSpan.textContent = data.spots_count || 0;
            confidenceSpan.textContent = data.confidence;

            // Сектора
            sectorChart.innerHTML = '';
            const sectorRisks = data.sector_risks;
            if (sectorRisks) {
                for (const [organ, risk] of Object.entries(sectorRisks)) {
                    const div = document.createElement('div');
                    div.className = 'sector-item';
                    let riskClass = 'risk-low';
                    if (risk > 70) riskClass = 'risk-high';
                    else if (risk > 40) riskClass = 'risk-mid';
                    div.innerHTML = `<div class="name">${organ}</div>
                                     <div class="risk ${riskClass}">${risk}%</div>`;
                    sectorChart.appendChild(div);
                }
            }

            resultDiv.style.display = 'block';
        })
        .catch(error => {
            alert('Ошибка соединения: ' + error.message);
        })
        .finally(() => {
            uploadBtn.disabled = false;
            uploadBtn.textContent = '🔍 Диагностировать';
        });
    });
});