import os
import cv2
import numpy as np
from flask import Flask, request, render_template, jsonify
from werkzeug.utils import secure_filename
import logging

app = Flask(__name__)
UPLOAD_FOLDER = 'static/uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
logging.basicConfig(level=logging.DEBUG)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def analyze_iris(image_path, eye_side):
    try:
        # 1. Загружаем изображение
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError("Не удалось загрузить изображение")

        # 2. Если правый глаз – зеркально отражаем по горизонтали
        if eye_side == 'right':
            img = cv2.flip(img, 1)  # 1 = горизонтальное отражение

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        h, w = gray.shape

        # 3. Центр и радиус радужки (упрощённо – центр изображения)
        cx, cy = w//2, h//2
        radius = int(min(h, w) * 0.3)
        if radius < 10:
            radius = 50

        # 4. Центральная область для проверки на гетерохромию
        center_size = int(radius * 0.5)
        center_roi = img[cy-center_size:cy+center_size, cx-center_size:cx+center_size]
        if center_roi.size == 0:
            center_roi = img[cy-10:cy+10, cx-10:cx+10]
        avg_color = np.mean(center_roi, axis=(0, 1))
        std_color = np.std(center_roi, axis=(0, 1))
        mean_std = np.mean(std_color)

        heterochromia_warning = None
        if mean_std > 30:
            heterochromia_warning = "Обнаружена неоднородность пигментации (возможна гетерохромия). Результат может быть неточным."

        # 5. Маска круга
        mask = np.zeros_like(gray)
        cv2.circle(mask, (cx, cy), radius, 255, -1)
        roi = cv2.bitwise_and(gray, gray, mask=mask)

        # 6. Детектор линий (Canny)
        edges = cv2.Canny(roi, 50, 150)
        lines_count = np.count_nonzero(edges)

        # 7. Детектор пятен (HoughCircles) – с защитой от ошибок
        spots_count = 0
        try:
            circles = cv2.HoughCircles(roi, cv2.HOUGH_GRADIENT, dp=1.2, minDist=20,
                                       param1=50, param2=30, minRadius=5, maxRadius=20)
            if circles is not None:
                circles = np.uint16(np.around(circles))
                spots_count = len(circles[0])
        except:
            pass

        # 8. Разбиваем радужку на 12 секторов (по 30 градусов)
        sector_counts = [0] * 12
        for y in range(max(0, cy-radius), min(h, cy+radius)):
            for x in range(max(0, cx-radius), min(w, cx+radius)):
                if (x-cx)**2 + (y-cy)**2 <= radius**2:
                    angle = np.degrees(np.arctan2(y-cy, x-cx)) % 360
                    sector = int(angle // 30)
                    if sector >= 12:
                        sector = 11
                    if edges[y, x] > 0:
                        sector_counts[sector] += 1

        # 9. Карта органов (условная) – теперь одинакова для обоих глаз,
        #    потому что правый мы уже отразили на уровне изображения
        organ_zones = {
            0: 'Головной мозг', 1: 'Глаза, уши', 2: 'Щитовидная железа',
            3: 'Печень', 4: 'Желчный пузырь', 5: 'Поджелудочная',
            6: 'Почки', 7: 'Надпочечники', 8: 'Мочевой пузырь',
            9: 'Сердце', 10: 'Лёгкие', 11: 'Желудок'
        }

        # 10. Расчёт рисков
        max_count = max(sector_counts) if sector_counts else 1
        sector_risks = {}
        for i, cnt in enumerate(sector_counts):
            risk = (cnt / max_count) * 100
            sector_risks[organ_zones[i]] = round(risk, 1)

        # 11. Диагноз – органы с риском > 70%
        high_risk = [org for org, risk in sector_risks.items() if risk > 70]
        if high_risk:
            diagnosis = 'Подозрение на: ' + ', '.join(high_risk)
        else:
            diagnosis = 'Все системы в норме (незначительные изменения)'

        # 12. Уверенность (имитация)
        confidence = round(80 + np.random.randint(0, 20), 1)

        return {
            'sector_risks': sector_risks,
            'diagnosis': diagnosis,
            'lines_count': int(lines_count),
            'spots_count': int(spots_count),
            'sector_counts': sector_counts,
            'eye_side': eye_side,
            'confidence': confidence,
            'warning': heterochromia_warning
        }
    except Exception as e:
        logging.error("Ошибка в analyze_iris: " + str(e))
        raise

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'Файл не выбран'}), 400
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'Пустое имя'}), 400
        if not allowed_file(file.filename):
            return jsonify({'error': 'Неверный формат (только PNG, JPG, JPEG)'}), 400

        eye_side = request.form.get('eye_side', 'left')
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)

        result = analyze_iris(filepath, eye_side)
        return jsonify(result)
    except Exception as e:
        logging.error("Ошибка в upload_file: " + str(e))
        return jsonify({'error': 'Внутренняя ошибка сервера: ' + str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)