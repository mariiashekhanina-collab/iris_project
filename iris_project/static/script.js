// static/script.js
document.addEventListener('DOMContentLoaded', function () {
    // Получаем элементы DOM
    const fileInput = document.getElementById('fileInput');
    const preview = document.getElementById('preview');
    const uploadBtn = document.getElementById('uploadBtn');
    const resultDiv = document.getElementById('result');
    const diagnosisText = document.getElementById('diagnosis-text');
    const linesSpan = document.getElementById('lines');
    const spotsSpan = document.getElementById('spots');
    const confidenceSpan = document.getElementById('confidence');
    const sectorChart = document.getElementById('sector-chart');
    const eyeSide = document.getElementById('eyeSide');
    const warningDiv = document.getElementById('warning'); // новый блок для предупреждения

    // Предпросмотр загруженного фото
    fileInput.addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (ev) {
                preview.src = ev.target.result;
                preview.style.display = 'block';
                resultDiv.style.display = 'none';
                // Скрываем предупреждение, если было
                warningDiv.style.display = 'none';
            };
            reader.readAsDataURL(file);
        }
    });

    // Отправка на сервер
    uploadBtn.addEventListener('click', function () {
        const file = fileInput.files[0];
        if (!file) {
            alert('Пожалуйста, выберите фото!');
            return;
        }

        // Блокируем кнопку и показываем процесс
        uploadBtn.disabled = true;
        uploadBtn.textContent = '⏳ Анализируем...';

        // Собираем данные формы
        const formData = new FormData();
        formData.append('file', file);
        formData.append('eye_side', eyeSide.value);

        // Отправляем запрос
        fetch('/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            // Проверяем, что ответ в формате JSON
            if (!response.ok) {
                return response.json().then(data => { throw new Error(data.error || 'Ошибка сервера'); });
            }
            return response.json();
        })
        .then(data => {
            // Обработка успешного ответа
            if (data.error) {
                alert('Ошибка: ' + data.error);
                return;
            }

            // Заполняем основные данные
            diagnosisText.textContent = data.diagnosis;
            linesSpan.textContent = data.lines_count;
            spotsSpan.textContent = data.spots_count;
            confidenceSpan.textContent = data.confidence;

            // Обработка предупреждения о гетерохромии
            if (data.warning) {
                warningDiv.textContent = '⚠️ ' + data.warning;
                warningDiv.style.display = 'block';
            } else {
                warningDiv.style.display = 'none';
            }

            // Отрисовка секторов
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

            // Показываем блок результата
            resultDiv.style.display = 'block';
        })
        .catch(error => {
            alert('Ошибка соединения: ' + error.message);
        })
        .finally(() => {
            // Возвращаем кнопку в исходное состояние
            uploadBtn.disabled = false;
            uploadBtn.textContent = '🔍 Диагностировать';
        });
    });
});