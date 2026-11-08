

let farmMapInstance = null;
let farmMapLoading = false;

let farmDrawingActive = false;
let farmDrawingPoints = [];
let farmDrawingFeatures = [];
let farmDrawingLine = null;
let farmDrawingPolygon = null;
// ID участка, который сейчас редактируется
let editingFarmPlotId = null;
// Сохранённые участки фермы
let savedFarmPlots = [];
let savedFarmFeatures = [];
// =====================================
// GPS-ТРЕКЕР ЖИВОТНЫХ
// =====================================

let gpsAnimalMarkers = [];
let gpsAnimalPositions = [];
let gpsSimulationTimer = null;
let gpsSimulationRunning = false;

const GPS_STORAGE_KEY = 'agroanimal_gps_positions';

// =====================================
// GPS — ПРОВЕРКА ГРАНИЦ УЧАСТКА
// =====================================

// Проверяем, находится ли точка внутри полигона
function isGpsPointInsidePlot(point, polygon) {

  const x = point[0];
  const y = point[1];

  let inside = false;

  for (
    let i = 0, j = polygon.length - 1;
    i < polygon.length;
    j = i++
  ) {

    const xi = polygon[i][0];
    const yi = polygon[i][1];

    const xj = polygon[j][0];
    const yj = polygon[j][1];

    const intersects =
      ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}


// Получаем случайную точку внутри участка
function getRandomGpsPoint(plot) {

  const points = plot.points;

  const minLng = Math.min(...points.map(point => point[0]));
  const maxLng = Math.max(...points.map(point => point[0]));

  const minLat = Math.min(...points.map(point => point[1]));
  const maxLat = Math.max(...points.map(point => point[1]));

  // Пробуем найти точку внутри границ
  for (let attempt = 0; attempt < 1000; attempt++) {

    const point = [
      minLng + Math.random() * (maxLng - minLng),
      minLat + Math.random() * (maxLat - minLat)
    ];

    if (isGpsPointInsidePlot(point, points)) {
      return point;
    }
  }

  // Если подходящая точка не найдена
  return null;
}

// =====================================
// GPS — СОЗДАНИЕ МАРКЕРОВ ЖИВОТНЫХ
// =====================================

function createGpsMarkers() {
  const language = getAgroLanguage();

  const gpsMessages = {
    ru: {
      mapNotLoaded: 'Карта ещё не загружена',
      noAnimals: 'На ферме пока нет животных',
      noPlots: 'Сначала сохрани хотя бы один участок фермы'
    },
    kk: {
      mapNotLoaded: 'Карта әлі жүктелмеген',
      noAnimals: 'Фермада әзірге жануарлар жоқ',
      noPlots: 'Алдымен кемінде бір ферма учаскесін сақта'
    },
    en: {
      mapNotLoaded: 'The map has not loaded yet',
      noAnimals: 'There are no animals on the farm yet',
      noPlots: 'Save at least one farm plot first'
    },
    fr: {
      mapNotLoaded: 'La carte n’est pas encore chargée',
      noAnimals: 'Il n’y a pas encore d’animaux à la ferme',
      noPlots: 'Enregistrez d’abord au moins une parcelle'
    },
    zh: {
      mapNotLoaded: '地图尚未加载',
      noAnimals: '农场里还没有动物',
      noPlots: '请先保存至少一块农场地块'
    }
  };

  const messages = gpsMessages[language] || gpsMessages.ru;
  if (!farmMapInstance) {
    notify(messages.mapNotLoaded);
    return;
  }

  const animals = getSavedAnimals();

  if (animals.length === 0) {
    notify(messages.noAnimals);
    return;
  }

  if (savedFarmPlots.length === 0) {
    notify(messages.noPlots);
    return;
  }

  const { YMapMarker } = ymaps3;

  // Удаляем предыдущие GPS-маркеры
  gpsAnimalMarkers.forEach(item => {
    farmMapInstance.removeChild(item.marker);
  });

  gpsAnimalMarkers = [];
  gpsAnimalPositions = [];

  // Загружаем сохранённые координаты
  let savedPositions = [];

  try {
    savedPositions = JSON.parse(
      localStorage.getItem(GPS_STORAGE_KEY)
    ) || [];
  } catch (error) {
    savedPositions = [];
  }

  animals.forEach(animal => {

    // Ищем ранее сохранённое положение животного
    const savedPosition = savedPositions.find(
      item => item.animalId === animal.id
    );

    let plot = savedFarmPlots.find(
      item => savedPosition && item.id === savedPosition.plotId
    );

    let coordinates = null;

    // Проверяем, что сохранённая точка всё ещё внутри участка
    if (
      plot &&
      Array.isArray(savedPosition.coordinates) &&
      isGpsPointInsidePlot(savedPosition.coordinates, plot.points)
    ) {
      coordinates = [...savedPosition.coordinates];
    } else {

      // Если старого положения нет — выбираем участок
      plot = savedFarmPlots[
        Math.floor(Math.random() * savedFarmPlots.length)
      ];

      coordinates = getRandomGpsPoint(plot);
    }

    if (!coordinates || !plot) {
      console.warn('Не удалось разместить животное:', animal.name);
      return;
    }

    // Создаём содержимое маркера
    const markerElement = document.createElement('div');

    markerElement.style.cssText = `
      display:flex;
      flex-direction:column;
      align-items:center;
      cursor:pointer;
      transform:translateY(-5px);
    `;

    const image = document.createElement('img');

    
// Изображения животных для игровой фермы
const farmAnimalImages = {
  cow: 'images/farm/animals/cow.png',
  chicken: 'images/farm/animals/chicken.png',
  sheep: 'images/farm/animals/sheep.png',
  pig: 'images/farm/animals/pig.png',
  horse: 'images/farm/animals/horse.png',
  goat: 'images/farm/animals/goat.png',
  duck: 'images/farm/animals/duck.png',
  turkey: 'images/farm/animals/turkey.png',
  rabbit: 'images/farm/animals/rabbit.png'
};

// Выбираем изображение
image.src =
  farmAnimalImages[animal.species] ||
  animalImages[animal.species] ||
  '';

    image.alt = animalNames[animal.species] || 'Животное';

    image.style.cssText = `
      width:42px;
      height:42px;
      object-fit:contain;
      filter:drop-shadow(0 2px 3px rgba(0,0,0,0.35));
    `;

    const label = document.createElement('div');

    label.textContent = animal.name || 'Животное';

    label.style.cssText = `
      background:white;
      color:#222;
      padding:3px 7px;
      border-radius:7px;
      font-size:11px;
      font-weight:600;
      white-space:nowrap;
      box-shadow:0 2px 5px rgba(0,0,0,0.2);
      margin-top:2px;
    `;

    markerElement.append(image, label);

    // Создаём маркер Яндекс Карт
    const marker = new YMapMarker(
      {
        coordinates: coordinates,
        zIndex: 2000
      },
      markerElement
    );

    farmMapInstance.addChild(marker);

    // Сохраняем данные маркера
    gpsAnimalMarkers.push({
      animalId: animal.id,
      marker: marker,
      element: markerElement,
      plotId: plot.id
    });

    gpsAnimalPositions.push({
      animalId: animal.id,
      plotId: plot.id,
      coordinates: [...coordinates]
    });

  });

  // Сохраняем координаты всех животных
  localStorage.setItem(
    GPS_STORAGE_KEY,
    JSON.stringify(gpsAnimalPositions)
  );

    // Сначала обновляем список животных
  renderGpsAnimals();

  // Затем обновляем GPS-статистику
  const activeElement = document.getElementById('gpsActiveAnimals');

  if (activeElement) {
    activeElement.textContent = gpsAnimalMarkers.length;
  }

  const statusElement = document.getElementById('gpsStatus');

  if (statusElement) {
    statusElement.textContent =
      '🟢 GPS-маркеры размещены: ' +
      gpsAnimalMarkers.length +
      ' из ' + animals.length + ' животных.';
  }

  console.log('GPS-маркеры созданы:', gpsAnimalMarkers.length);
}

// =====================================
// GPS — ДВИЖЕНИЕ ЖИВОТНЫХ
// =====================================
const gpsStatusTranslations = {
  ru: {
    running: '🟢 GPS работает. Животные перемещаются по пастбищам.',
    started: 'GPS-симуляция запущена!',
    stopped: '⏸ GPS-симуляция остановлена. Координаты сохранены.'
  },
  kk: {
    running: '🟢 GPS жұмыс істеп тұр. Жануарлар жайылымда қозғалып жүр.',
    started: 'GPS-симуляция іске қосылды!',
    stopped: '⏸ GPS-симуляция тоқтатылды. Координаттар сақталды.'
  },
  en: {
    running: '🟢 GPS is running. Animals are moving around the pastures.',
    started: 'GPS simulation started!',
    stopped: '⏸ GPS simulation stopped. Coordinates saved.'
  },
  fr: {
    running: '🟢 GPS fonctionne. Les animaux se déplacent dans les pâturages.',
    started: 'Simulation GPS démarrée !',
    stopped: '⏸ Simulation GPS arrêtée. Coordonnées enregistrées.'
  },
  zh: {
    running: '🟢 GPS 正在运行。动物正在牧场中移动。',
    started: 'GPS 模拟已启动！',
    stopped: '⏸ GPS 模拟已停止。坐标已保存。'
  }
};
function startGpsSimulation() {

  // Останавливаем предыдущую симуляцию
  stopGpsSimulation();

  // Создаём актуальные маркеры животных
  createGpsMarkers();

  if (gpsAnimalMarkers.length === 0) {
    return;
  }

  gpsSimulationRunning = true;

  let saveCounter = 0;

  gpsSimulationTimer = setInterval(() => {

    gpsAnimalMarkers.forEach(item => {

      const position = gpsAnimalPositions.find(
        p => p.animalId === item.animalId
      );

      const plot = savedFarmPlots.find(
        p => p.id === item.plotId
      );

      if (!position || !plot) return;

      // Если цели нет — выбираем новую
      if (!item.targetCoordinates) {
        item.targetCoordinates = getRandomGpsPoint(plot);
      }

      if (!item.targetCoordinates) return;

      const current = position.coordinates;
      const target = item.targetCoordinates;

      // Рассчитываем расстояние до цели
      const dx = target[0] - current[0];
      const dy = target[1] - current[1];

      const distance = Math.sqrt(dx * dx + dy * dy);

      // Если достигли цели — выбираем следующую
      if (distance < 0.000001) {
        item.targetCoordinates = getRandomGpsPoint(plot);
        return;
      }

      // Плавное перемещение к цели
      const nextCoordinates = [
        current[0] + dx * 0.004,
        current[1] + dy * 0.004
      ];

      // Проверяем, что новая точка внутри участка
      if (!isGpsPointInsidePlot(nextCoordinates, plot.points)) {
        item.targetCoordinates = getRandomGpsPoint(plot);
        return;
      }

      // Обновляем координаты маркера
      item.marker.update({
        coordinates: nextCoordinates
      });

      position.coordinates = nextCoordinates;

    });

    // Периодически сохраняем координаты
    saveCounter++;

    if (saveCounter >= 5) {
      saveCounter = 0;

      localStorage.setItem(
        GPS_STORAGE_KEY,
        JSON.stringify(gpsAnimalPositions)
      );
    }

  }, 1000);

  const messages =
  gpsStatusTranslations[getAgroLanguage()] ||
  gpsStatusTranslations.ru;

const status = document.getElementById('gpsStatus');

if (status) {
  status.textContent = messages.running;
}

notify(messages.started);
}


// =====================================
// GPS — ОСТАНОВКА ДВИЖЕНИЯ
// =====================================

function stopGpsSimulation() {

  if (gpsSimulationTimer) {
    clearInterval(gpsSimulationTimer);
    gpsSimulationTimer = null;
  }

  gpsSimulationRunning = false;

  // Сохраняем последние координаты
  try {
    localStorage.setItem(
      GPS_STORAGE_KEY,
      JSON.stringify(gpsAnimalPositions)
    );
  } catch (error) {
    console.error('Ошибка сохранения GPS:', error);
  }

  const status = document.getElementById('gpsStatus');

  if (status) {
    const messages = gpsStatusTranslations[getAgroLanguage()] || gpsStatusTranslations.ru;
status.textContent = messages.stopped;
  }
}

const FARM_PLOTS_STORAGE_KEY = 'agroanimal_farm_plots';
// Сохранённое положение карты фермы
const FARM_MAP_VIEW_KEY = 'agroanimal_farm_map_view';
// Расчёт площади участка в гектарах
function calculateFarmArea(points) {
  const earthRadius = 6378137;

  let area = 0;

  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];

    const lon1 = current[0] * Math.PI / 180;
    const lat1 = current[1] * Math.PI / 180;

    const lon2 = next[0] * Math.PI / 180;
    const lat2 = next[1] * Math.PI / 180;

    area += (lon2 - lon1) *
      (2 + Math.sin(lat1) + Math.sin(lat2));
  }

  const squareMeters =
    Math.abs(area) * earthRadius * earthRadius / 2;

  return squareMeters / 10000;
}
function createSavedFarmPolygon(points) {
  const { YMapFeature } = ymaps3;

  return new YMapFeature({
    geometry: {
      type: 'Polygon',
      coordinates: [[...points, points[0]]]
    },
    style: {
      fill: '#35a853',
      fillOpacity: 0.3,
      stroke: [
        {
          color: '#16833a',
          width: 4
        }
      ]
    }
  });
}

function renderSavedFarmPlots() {
    const plotTranslations = {
  ru: {
    empty: 'Пока участки не добавлены.',
    area: 'Площадь: ',
    unit: 'га',
    view: '🔍 Посмотреть участок',
    edit: '📍 Изменить границы',
    rename: '✏️ Переименовать',
    renamePrompt: 'Введи новое название участка:',
    emptyName: 'Название не может быть пустым',
    renamed: 'Участок переименован!',
    renameError: 'Не удалось сохранить новое название',
    remove: '🗑️ Удалить',
    confirmDelete: 'Удалить участок «',
    deleted: 'Участок удалён',
    deleteError: 'Не удалось удалить участок'
  },

  kk: {
    empty: 'Әзірге учаскелер қосылмаған.',
    area: 'Ауданы: ',
    unit: 'га',
    view: '🔍 Учаскені көру',
    edit: '📍 Шекараларын өзгерту',
    rename: '✏️ Қайта атау',
    renamePrompt: 'Учаскенің жаңа атауын енгіз:',
    emptyName: 'Атау бос болмауы керек',
    renamed: 'Учаске қайта аталды!',
    renameError: 'Жаңа атауды сақтау мүмкін болмады',
    remove: '🗑️ Жою',
    confirmDelete: 'Учаскені жою «',
    deleted: 'Учаске жойылды',
    deleteError: 'Учаскені жою мүмкін болмады'
  },

  en: {
    empty: 'No plots have been added yet.',
    area: 'Area: ',
    unit: 'ha',
    view: '🔍 View plot',
    edit: '📍 Edit boundaries',
    rename: '✏️ Rename',
    renamePrompt: 'Enter a new plot name:',
    emptyName: 'The name cannot be empty',
    renamed: 'Plot renamed!',
    renameError: 'Could not save the new name',
    remove: '🗑️ Delete',
    confirmDelete: 'Delete plot "',
    deleted: 'Plot deleted',
    deleteError: 'Could not delete the plot'
  },

  fr: {
    empty: 'Aucune parcelle ajoutée pour le moment.',
    area: 'Superficie : ',
    unit: 'ha',
    view: '🔍 Voir la parcelle',
    edit: '📍 Modifier les limites',
    rename: '✏️ Renommer',
    renamePrompt: 'Saisissez le nouveau nom de la parcelle :',
    emptyName: 'Le nom ne peut pas être vide',
    renamed: 'Parcelle renommée !',
    renameError: 'Impossible d’enregistrer le nouveau nom',
    remove: '🗑️ Supprimer',
    confirmDelete: 'Supprimer la parcelle «',
    deleted: 'Parcelle supprimée',
    deleteError: 'Impossible de supprimer la parcelle'
  },

  zh: {
    empty: '尚未添加地块。',
    area: '面积：',
    unit: '公顷',
    view: '🔍 查看地块',
    edit: '📍 修改边界',
    rename: '✏️ 重命名',
    renamePrompt: '请输入新的地块名称：',
    emptyName: '名称不能为空',
    renamed: '地块已重命名！',
    renameError: '无法保存新名称',
    remove: '🗑️ 删除',
    confirmDelete: '确定删除地块“',
    deleted: '地块已删除',
    deleteError: '无法删除地块'
  }
  };

  const t = plotTranslations[getAgroLanguage()] || plotTranslations.ru;
  const list = document.getElementById('farmPlotsList');
  const totalElement = document.getElementById('totalFarmArea');

  if (!list || !totalElement) return;

  list.replaceChildren();

  if (savedFarmPlots.length === 0) {
    const message = document.createElement('p');

    message.style.color = 'var(--muted)';
    message.style.fontSize = '13px';
    message.textContent = t.empty;

    list.appendChild(message);
  }

  let totalArea = 0;

  savedFarmPlots.forEach((plot, index) => {
    totalArea += plot.area;

    const card = document.createElement('div');

    card.style.padding = '14px';
    card.style.marginBottom = '10px';
    card.style.border = '1px solid var(--border)';
    card.style.borderRadius = '12px';

    const name = document.createElement('h3');
    name.textContent = '🌿 ' + plot.name;
    name.style.margin = '0 0 8px';

    const area = document.createElement('p');
    area.textContent =
  t.area +
  plot.area.toFixed(2).replace('.', ',') +
  ' ' + t.unit;

    area.style.margin = '0 0 12px';
    area.style.fontSize = '13px';

    // Кнопка просмотра
    const viewButton = document.createElement('button');

    viewButton.type = 'button';
    viewButton.textContent = t.view;

    viewButton.onclick = () => {
      const centerLon =
        plot.points.reduce((sum, point) => sum + point[0], 0) /
        plot.points.length;

      const centerLat =
        plot.points.reduce((sum, point) => sum + point[1], 0) /
        plot.points.length;

      farmMapInstance.update({
        location: {
          center: [centerLon, centerLat],
          zoom: 15,
          duration: 500
        }
      });

      document.getElementById('farmMap').scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    };
    // Кнопка редактирования границ
const editButton = document.createElement('button');

editButton.type = 'button';
editButton.textContent = t.edit;

editButton.style.marginRight = '8px';

editButton.onclick = () => {
  startEditingFarmPlot(plot.id);
};
   // Кнопка переименования
const renameButton = document.createElement('button');

renameButton.type = 'button';
renameButton.textContent = t.rename;
renameButton.style.marginRight = '8px';

renameButton.onclick = () => {
  const newName = prompt(
    t.enterName,
    plot.name
  );

  if (newName === null) return;

  const trimmedName = newName.trim();

  if (!trimmedName) {
    notify(t.emptyName);
    return;
  }

  const oldName = plot.name;

  plot.name = trimmedName;

  try {
    localStorage.setItem(
      FARM_PLOTS_STORAGE_KEY,
      JSON.stringify(savedFarmPlots)
    );

    renderSavedFarmPlots();

    notify(t.renamed);

  } catch (error) {
    plot.name = oldName;

    console.error('Ошибка переименования:', error);

    notify(t.renameError);
  }
};
    // Кнопка удаления
    const deleteButton = document.createElement('button');

    deleteButton.type = 'button';
    deleteButton.textContent = t.remove;

    deleteButton.style.marginLeft = '8px';

    deleteButton.onclick = () => {
      const confirmed = confirm(
  t.confirmDelete + plot.name + (getAgroLanguage() === 'en' ? '"' : '»') + '?'
);

      if (!confirmed) return;

      try {
        const feature = savedFarmFeatures[index];

        if (feature) {
          farmMapInstance.removeChild(feature);
        }

        savedFarmPlots.splice(index, 1);
        savedFarmFeatures.splice(index, 1);

        localStorage.setItem(
          FARM_PLOTS_STORAGE_KEY,
          JSON.stringify(savedFarmPlots)
        );

        renderSavedFarmPlots();

        notify(t.deleted);

      } catch (error) {
        console.error('Ошибка удаления участка:', error);
        notify(t.deleteError);
      }
    };

    card.appendChild(name);
card.appendChild(area);
card.appendChild(viewButton);
card.appendChild(editButton);
card.appendChild(renameButton);
card.appendChild(deleteButton);

    list.appendChild(card);
  });

  const formattedArea =
  totalArea.toFixed(2).replace('.', ',') + ' ' + t.unit;

totalElement.textContent = formattedArea;

// Обновляем площадь на главной странице
const homeFarmArea = document.getElementById('homeFarmArea');
const homeFarmAreaScene = document.getElementById('homeFarmAreaScene');

if (homeFarmArea) {
  homeFarmArea.textContent = formattedArea;
}

if (homeFarmAreaScene) {
  homeFarmAreaScene.textContent = formattedArea;
}
}

// Загрузка сохранённых участков
function loadSavedFarmPlots() {
  try {
    const stored = localStorage.getItem(FARM_PLOTS_STORAGE_KEY);

    savedFarmPlots = stored ? JSON.parse(stored) : [];

    if (!Array.isArray(savedFarmPlots)) {
      savedFarmPlots = [];
    }

    savedFarmPlots = savedFarmPlots.filter(plot =>
      plot &&
      typeof plot.name === 'string' &&
      typeof plot.area === 'number' &&
      Array.isArray(plot.points) &&
      plot.points.length >= 3
    );

    savedFarmPlots.forEach(plot => {
      const polygon = createSavedFarmPolygon(plot.points);

      farmMapInstance.addChild(polygon);
      savedFarmFeatures.push(polygon);
    });

    renderSavedFarmPlots();

  } catch (error) {
    console.error('Ошибка загрузки участков:', error);
    savedFarmPlots = [];
    renderSavedFarmPlots();
  }
}
// Обновление счётчика точек
function updateDrawingInfo() {
  const count = document.getElementById('drawingPointsCount');
  const status = document.getElementById('drawingStatus');

  const messages = {
    ru: {
      active: '🟢 Разметка активна. Нажимай на карту, чтобы добавлять точки.',
      waiting: 'Ожидание начала разметки.'
    },
    kk: {
      active: '🟢 Белгілеу белсенді. Нүктелер қосу үшін картаны бас.',
      waiting: 'Белгілеудің басталуын күту.'
    },
    en: {
      active: '🟢 Drawing is active. Click the map to add points.',
      waiting: 'Waiting for drawing to start.'
    },
    fr: {
      active: '🟢 Le tracé est actif. Cliquez sur la carte pour ajouter des points.',
      waiting: 'En attente du début du tracé.'
    },
    zh: {
      active: '🟢 标记已启动。点击地图添加点。',
      waiting: '等待开始标记。'
    }
  };

  const t = messages[getAgroLanguage()] || messages.ru;

  if (count) {
    count.textContent = farmDrawingPoints.length;
  }

  if (status) {
    status.textContent = farmDrawingActive
      ? t.active
      : t.waiting;
  }
}

// Добавление точки на карту
function addFarmPoint(coordinates) {
  if (!farmDrawingActive) return;

  const { YMapFeature } = ymaps3;

  farmDrawingPoints.push(coordinates);

  // Создаём видимую точку
  const marker = document.createElement('div');

  marker.style.width = '14px';
  marker.style.height = '14px';
  marker.style.background = '#e53935';
  marker.style.border = '3px solid white';
  marker.style.borderRadius = '50%';
  marker.style.boxShadow = '0 1px 5px rgba(0,0,0,0.5)';

  const pointFeature = new YMapFeature({
    geometry: {
      type: 'Point',
      coordinates: coordinates
    },
    style: {
      element: marker
    }
  });

  farmMapInstance.addChild(pointFeature);
  farmDrawingFeatures.push(pointFeature);

  // Обновляем линию между точками
  if (farmDrawingLine) {
    farmMapInstance.removeChild(farmDrawingLine);
    farmDrawingLine = null;
  }

  if (farmDrawingPoints.length >= 2) {
    farmDrawingLine = new YMapFeature({
      geometry: {
        type: 'LineString',
        coordinates: farmDrawingPoints
      },
      style: {
        stroke: [
          {
            color: '#e53935',
            width: 4
          }
        ]
      }
    });

    farmMapInstance.addChild(farmDrawingLine);
  }

  updateDrawingInfo();
}

// Очистка текущей разметки
function clearFarmDrawing() {
  farmDrawingFeatures.forEach(feature => {
    farmMapInstance.removeChild(feature);
  });

  farmDrawingFeatures = [];

  if (farmDrawingLine) {
    farmMapInstance.removeChild(farmDrawingLine);
    farmDrawingLine = null;
  }

  if (farmDrawingPolygon) {
  farmMapInstance.removeChild(farmDrawingPolygon);
  farmDrawingPolygon = null;
}
  farmDrawingPoints = [];
  farmDrawingActive = false;

  const area = document.getElementById('drawingArea');

  if (area) {
    area.textContent = '0 га';
  }

  updateDrawingInfo();
}
// Начало редактирования существующего участка
function startEditingFarmPlot(plotId) {
  const plot = savedFarmPlots.find(item => item.id === plotId);

  if (!plot) {
    notify('Участок не найден');
    return;
  }

  // Очищаем только временную разметку
  clearFarmDrawing();

  editingFarmPlotId = plotId;
  farmDrawingActive = true;

  // Приближаем карту к выбранному участку
  const centerLon =
    plot.points.reduce((sum, point) => sum + point[0], 0) /
    plot.points.length;

  const centerLat =
    plot.points.reduce((sum, point) => sum + point[1], 0) /
    plot.points.length;

  farmMapInstance.update({
    location: {
      center: [centerLon, centerLat],
      zoom: 16,
      duration: 500
    }
  });

  document.getElementById('drawingStatus').textContent =
    '✏️ Редактирование участка «' + plot.name +
    '». Отметь новые точки границы.';

  document.getElementById('farmPlotName').value = plot.name;

  updateDrawingInfo();

  notify('Режим редактирования включён!');
}
// Создание карты фермы
async function initializeFarmMap() {
  if (farmMapInstance || farmMapLoading) return;

  farmMapLoading = true;

  try {
    await ymaps3.ready;

    const mapContainer = document.getElementById('farmMap');

    if (!mapContainer) return;

    const {
      YMap,
      YMapDefaultSchemeLayer,
      YMapDefaultFeaturesLayer,
      YMapListener
    } = ymaps3;

    // Загружаем последнее сохранённое положение карты
let savedMapView = null;

try {
  savedMapView = JSON.parse(
    localStorage.getItem(FARM_MAP_VIEW_KEY)
  );
} catch (error) {
  console.warn('Не удалось прочитать положение карты:', error);
}

// Проверяем сохранённые координаты
const validSavedMapView =
  savedMapView &&
  Array.isArray(savedMapView.center) &&
  savedMapView.center.length === 2 &&
  savedMapView.center.every(Number.isFinite) &&
  Number.isFinite(savedMapView.zoom);

// Создаём карту с сохранённым положением
farmMapInstance = new YMap(mapContainer, {
  location: validSavedMapView
    ? {
        center: savedMapView.center,
        zoom: savedMapView.zoom
      }
    : {
        center: [63.6246, 53.2144],
        zoom: 12
      }
});

    // Слой карты
    farmMapInstance.addChild(
      new YMapDefaultSchemeLayer()
    );

    // Слой для точек и линий
    farmMapInstance.addChild(
      new YMapDefaultFeaturesLayer()
    );
    // Восстанавливаем сохранённые участки
loadSavedFarmPlots();

  // Открытие и закрытие инструментов новой территории
  const toggleDrawingToolsBtn = document.getElementById('toggleDrawingToolsBtn');
  const territoryDrawingTools = document.getElementById('territoryDrawingTools');

  if (toggleDrawingToolsBtn && territoryDrawingTools) {

    toggleDrawingToolsBtn.onclick = () => {

      const isHidden = territoryDrawingTools.style.display === 'none';

      const translations = agroTranslations[getAgroLanguage()] || agroTranslations.ru;

if (isHidden) {
  territoryDrawingTools.style.display = 'block';
  toggleDrawingToolsBtn.textContent = '✕ ' + translations.close;
  toggleDrawingToolsBtn.setAttribute('aria-expanded', 'true');
} else {
  territoryDrawingTools.style.display = 'none';
  toggleDrawingToolsBtn.textContent = translations.newTerritory;
  toggleDrawingToolsBtn.setAttribute('aria-expanded', 'false');
}

    };

  }

// Кнопка запуска GPS
const startGpsButton = document.getElementById('startGpsBtn');

if (startGpsButton) {
  startGpsButton.onclick = startGpsSimulation;
}

// Кнопка остановки GPS
const stopGpsButton = document.getElementById('stopGpsBtn');

if (stopGpsButton) {
  stopGpsButton.onclick = stopGpsSimulation;
}
    // Обработка нажатий на карту
    const mapListener = new YMapListener({
  layer: 'any',

  // Сохраняем положение и масштаб карты
  onUpdate: ({ location, mapInAction }) => {

    if (mapInAction) return;

    if (
      !location ||
      !Array.isArray(location.center) ||
      !Number.isFinite(location.zoom)
    ) {
      return;
    }

    try {
      localStorage.setItem(
        FARM_MAP_VIEW_KEY,
        JSON.stringify({
          center: location.center,
          zoom: location.zoom
        })
      );
    } catch (error) {
      console.warn('Не удалось сохранить положение карты:', error);
    }
  },

  // Обработка нажатий на карту
  onClick: (object, event) => {
    if (!farmDrawingActive) return;

    if (event && event.coordinates) {
      addFarmPoint(event.coordinates);
    }
  }
});

    farmMapInstance.addChild(mapListener);

    // Кнопка начала разметки
    document.getElementById('startDrawingBtn').onclick = () => {

  clearFarmDrawing();

  // Это будет создание нового участка
  editingFarmPlotId = null;

  document.getElementById('farmPlotName').value = '';

  farmDrawingActive = true;

  updateDrawingInfo();
};

    // Кнопка завершения разметки
    // Кнопка завершения разметки
document.getElementById('finishDrawingBtn').onclick = () => {

  if (farmDrawingPoints.length < 3) {
    notify('Для участка необходимо минимум 3 точки');
    return;
  }

  farmDrawingActive = false;

  // Замыкаем контур
  const closedCoordinates = [
    ...farmDrawingPoints,
    farmDrawingPoints[0]
  ];

  // Удаляем временную линию
  if (farmDrawingLine) {
    farmMapInstance.removeChild(farmDrawingLine);
    farmDrawingLine = null;
  }

  // Создаём залитый полигон
  const { YMapFeature } = ymaps3;

  farmDrawingPolygon = new YMapFeature({
    geometry: {
      type: 'Polygon',
      coordinates: [closedCoordinates]
    },
    style: {
      fill: '#35a853',
      fillOpacity: 0.3,
      stroke: [
        {
          color: '#16833a',
          width: 4
        }
      ]
    }
  });

  farmMapInstance.addChild(farmDrawingPolygon);

  // Рассчитываем площадь
  const area = calculateFarmArea(farmDrawingPoints);

  // Показываем площадь
  document.getElementById('drawingArea').textContent =
    area.toFixed(2).replace('.', ',') + ' га';

  document.getElementById('drawingStatus').textContent =
    '✅ Участок замкнут! Площадь рассчитана: ' +
    area.toFixed(2).replace('.', ',') + ' га';

  updateDrawingInfo();

  // Возвращаем правильный статус после обновления счётчика
  document.getElementById('drawingStatus').textContent =
    '✅ Участок замкнут! Площадь рассчитана: ' +
    area.toFixed(2).replace('.', ',') + ' га';

};

    // Кнопка отмены
    document.getElementById('cancelDrawingBtn').onclick = () => {

  clearFarmDrawing();

  editingFarmPlotId = null;

  document.getElementById('farmPlotName').value = '';

  document.getElementById('drawingStatus').textContent =
    'Разметка отменена. Сохранённые участки не изменены.';

};
    // Кнопка сохранения участка

// Кнопка сохранения участка
document.getElementById('saveDrawingBtn').onclick = () => {

  if (farmDrawingActive || !farmDrawingPolygon) {
    notify('Сначала заверши разметку участка');
    return;
  }

  if (farmDrawingPoints.length < 3) {
    notify('Недостаточно точек для сохранения');
    return;
  }

  const nameInput = document.getElementById('farmPlotName');
  const enteredName = nameInput.value.trim();

  // Проверяем режим редактирования
  const editingIndex = editingFarmPlotId !== null
    ? savedFarmPlots.findIndex(
        plot => plot.id === editingFarmPlotId
      )
    : -1;

  if (editingFarmPlotId !== null && editingIndex === -1) {
    notify('Редактируемый участок не найден');
    return;
  }

  // При редактировании сохраняем старое название,
  // если новое не введено
  const name = enteredName ||
    (editingIndex >= 0
      ? savedFarmPlots[editingIndex].name
      : '');

  if (!name) {
    notify('Введи название участка');
    nameInput.focus();
    return;
  }

  const area = calculateFarmArea(farmDrawingPoints);

  const plot = {
    id: editingIndex >= 0
      ? savedFarmPlots[editingIndex].id
      : Date.now(),

    name: name,

    points: farmDrawingPoints.map(point => [...point]),

    area: area
  };

  // Подготавливаем новые данные
  const updatedPlots = [...savedFarmPlots];

  if (editingIndex >= 0) {
    updatedPlots[editingIndex] = plot;
  } else {
    updatedPlots.push(plot);
  }

  // Сначала сохраняем данные
  try {
    localStorage.setItem(
      FARM_PLOTS_STORAGE_KEY,
      JSON.stringify(updatedPlots)
    );

  } catch (error) {
    console.error('Ошибка сохранения участка:', error);
    notify('Не удалось сохранить участок');
    return;
  }

  // Если редактируем старый участок
  if (editingIndex >= 0) {

    const oldFeature = savedFarmFeatures[editingIndex];

    if (oldFeature) {
      farmMapInstance.removeChild(oldFeature);
    }

    savedFarmFeatures[editingIndex] = farmDrawingPolygon;

  } else {

    // Если создаём новый участок
    savedFarmFeatures.push(farmDrawingPolygon);
  }

  // Обновляем список участков
  savedFarmPlots = updatedPlots;

  // Передаём новый полигон в сохранённые
  farmDrawingPolygon = null;

  // Удаляем временные маркеры
  farmDrawingFeatures.forEach(feature => {
    farmMapInstance.removeChild(feature);
  });

  farmDrawingFeatures = [];

  // Очищаем временные данные
  farmDrawingPoints = [];
  editingFarmPlotId = null;

  if (farmDrawingLine) {
    farmMapInstance.removeChild(farmDrawingLine);
    farmDrawingLine = null;
  }

  const areaElement = document.getElementById('drawingArea');

  if (areaElement) {
    areaElement.textContent = '0 га';
  }

  nameInput.value = '';

  updateDrawingInfo();

  renderSavedFarmPlots();

  const status = document.getElementById('drawingStatus');

  if (status) {
    status.textContent =
      '✅ Участок «' + name + '» успешно сохранён!';
  }

  notify('Изменения участка сохранены!');
};


    updateDrawingInfo();

    console.log('Карта и инструменты разметки загружены!');

  } catch (error) {
    console.error('Ошибка загрузки карты:', error);
    notify('Не удалось загрузить Яндекс Карту');

  } finally {
    farmMapLoading = false;
  }
}


function showPage(page) {
  document.querySelectorAll('.page-section').forEach(section => {
    section.classList.remove('active');
  });

  const target = document.getElementById(page);
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(button => {
    button.classList.toggle('active', button.dataset.page === page);
  });

  // Загружаем карту при первом открытии территории
  if (page === 'territory') {
    initializeFarmMap();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}


document.querySelectorAll('.nav-item').forEach(button => {
  button.addEventListener('click', () => showPage(button.dataset.page));
});

let toastTimer;
function notify(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}
// =====================================
// AGROANIMALPROAI — УПРАВЛЕНИЕ ЖИВОТНЫМИ
// =====================================

const ANIMAL_STORAGE = 'agroanimal_animals';

let currentAnimalId = null;
let editingAnimalId = null;
let currentAnimalFilter = 'all';

// Картинки животных
const animalImages = {
  cow: 'images/cow.png',
  horse: 'images/horse.png',
  sheep: 'images/sheep.png',
  goat: 'images/goat.png',
  pig: 'images/pig.png',
  chicken: 'images/chicken.png'
};

// Названия видов
const animalNames = {
  cow: 'Корова',
  horse: 'Лошадь',
  sheep: 'Овца',
  goat: 'Коза',
  pig: 'Свинья',
  chicken: 'Курица'
};

// =====================================
// ПОРОДЫ И ОКРАСЫ ЖИВОТНЫХ
// =====================================

const animalOptions = {
  cow: {
    breeds: [
      'Голштинская',
      'Джерсейская',
      'Симментальская',
      'Айрширская',
      'Герефордская',
      'Ангусская',
      'Швицкая',
      'Калмыцкая',
      'Казахская белоголовая',
      'Ярославская',
      'Холмогорская'
    ],
    colors: [
      'Чёрно-белая',
      'Красно-белая',
      'Рыжая',
      'Чёрная',
      'Белая',
      'Бурая',
      'Пёстрая',
      'Серая'
    ]
  },

  horse: {
    breeds: [
      'Арабская',
      'Ахалтекинская',
      'Орловский рысак',
      'Английская чистокровная',
      'Будённовская',
      'Донская',
      'Казахская',
      'Фризская',
      'Шетлендский пони',
      'Тяжеловоз'
    ],
    colors: [
      'Гнедая',
      'Вороная',
      'Рыжая',
      'Серая',
      'Буланая',
      'Соловая',
      'Чалая',
      'Пегая',
      'Игреневая'
    ]
  },

  pig: {
    breeds: [
      'Крупная белая',
      'Ландрас',
      'Дюрок',
      'Пьетрен',
      'Йоркширская',
      'Миргородская',
      'Беркширская',
      'Уржумская'
    ],
    colors: [
      'Белая',
      'Розовая',
      'Чёрная',
      'Рыжая',
      'Пёстрая',
      'Серо-розовая'
    ]
  },

  chicken: {
    breeds: [
      'Леггорн',
      'Род-Айленд',
      'Брама',
      'Кохинхин',
      'Орпингтон',
      'Плимутрок',
      'Минорка',
      'Суссекс',
      'Русская белая',
      'Адлерская серебристая',
      'Австралорп'
    ],
    colors: [
      'Белая',
      'Чёрная',
      'Рыжая',
      'Коричневая',
      'Пёстрая',
      'Серая',
      'Золотистая',
      'Серебристая'
    ]
  },

  sheep: {
    breeds: [
      'Меринос',
      'Романовская',
      'Эдильбаевская',
      'Гиссарская',
      'Дорпер',
      'Тексель',
      'Каракульская',
      'Цигайская',
      'Суффолк'
    ],
    colors: [
      'Белая',
      'Чёрная',
      'Серая',
      'Коричневая',
      'Рыжая',
      'Пёстрая',
      'Чёрно-белая'
    ]
  },

  goat: {
    breeds: [
      'Зааненская',
      'Нубийская',
      'Альпийская',
      'Ламанча',
      'Ангорская',
      'Тоггенбургская',
      'Оренбургская',
      'Придонская',
      'Горьковская'
    ],
    colors: [
      'Белая',
      'Чёрная',
      'Коричневая',
      'Рыжая',
      'Серая',
      'Пятнистая',
      'Чёрно-белая',
      'Трёхцветная'
    ]
  }
};
// Переводы элементов списков пород и окрасов
const animalOptionUiTranslations = {
  ru: {
    breedPlaceholder: 'Выбери породу',
    colorPlaceholder: 'Выбери окрас',
    custom: 'Другое (ввести самостоятельно)'
  },
  kk: {
    breedPlaceholder: 'Тұқымды таңда',
    colorPlaceholder: 'Түсті таңда',
    custom: 'Басқа (өздігінен енгізу)'
  },
  en: {
    breedPlaceholder: 'Choose a breed',
    colorPlaceholder: 'Choose a color',
    custom: 'Other (enter manually)'
  },
  fr: {
    breedPlaceholder: 'Choisir une race',
    colorPlaceholder: 'Choisir une couleur',
    custom: 'Autre (saisir manuellement)'
  },
  zh: {
    breedPlaceholder: '选择品种',
    colorPlaceholder: '选择颜色',
    custom: '其他（手动输入）'
  }
};

const animalOptionTranslations = {
  en: {
    'Голштинская': 'Holstein',
    'Джерсейская': 'Jersey',
    'Симментальская': 'Simmental',
    'Айрширская': 'Ayrshire',
    'Герефордская': 'Hereford',
    'Ангусская': 'Angus',
    'Швицкая': 'Brown Swiss',
    'Калмыцкая': 'Kalmyk',
    'Казахская белоголовая': 'Kazakh Whiteheaded',
    'Ярославская': 'Yaroslavl',
    'Холмогорская': 'Kholmogory',
    'Арабская': 'Arabian',
    'Ахалтекинская': 'Akhal-Teke',
    'Орловский рысак': 'Orlov Trotter',
    'Английская чистокровная': 'Thoroughbred',
    'Будённовская': 'Budyonny',
    'Донская': 'Don',
    'Казахская': 'Kazakh',
    'Фризская': 'Friesian',
    'Шетлендский пони': 'Shetland Pony',
    'Тяжеловоз': 'Draft Horse',
    'Крупная белая': 'Large White',
    'Ландрас': 'Landrace',
    'Дюрок': 'Duroc',
    'Пьетрен': 'Pietrain',
    'Йоркширская': 'Yorkshire',
    'Миргородская': 'Myrhorod',
    'Беркширская': 'Berkshire',
    'Уржумская': 'Urzhum',
    'Леггорн': 'Leghorn',
    'Род-Айленд': 'Rhode Island Red',
    'Брама': 'Brahma',
    'Кохинхин': 'Cochin',
    'Орпингтон': 'Orpington',
    'Плимутрок': 'Plymouth Rock',
    'Минорка': 'Minorca',
    'Суссекс': 'Sussex',
    'Русская белая': 'Russian White',
    'Адлерская серебристая': 'Adler Silver',
    'Австралорп': 'Australorp',
    'Меринос': 'Merino',
    'Романовская': 'Romanov',
    'Эдильбаевская': 'Edilbay',
    'Гиссарская': 'Gissar',
    'Дорпер': 'Dorper',
    'Тексель': 'Texel',
    'Каракульская': 'Karakul',
    'Цигайская': 'Tsigai',
    'Суффолк': 'Suffolk',
    'Зааненская': 'Saanen',
    'Нубийская': 'Nubian',
    'Альпийская': 'Alpine',
    'Ламанча': 'LaMancha',
    'Ангорская': 'Angora',
    'Тоггенбургская': 'Toggenburg',
    'Оренбургская': 'Orenburg',
    'Придонская': 'Pridonskaya',
    'Горьковская': 'Gorky',

    'Чёрно-белая': 'Black and white',
    'Красно-белая': 'Red and white',
    'Рыжая': 'Red',
    'Чёрная': 'Black',
    'Белая': 'White',
    'Бурая': 'Brown',
    'Пёстрая': 'Spotted',
    'Серая': 'Gray',
    'Гнедая': 'Bay',
    'Вороная': 'Black',
    'Буланая': 'Dun',
    'Соловая': 'Palomino',
    'Чалая': 'Roan',
    'Пегая': 'Piebald',
    'Игреневая': 'Flaxen chestnut',
    'Розовая': 'Pink',
    'Серо-розовая': 'Gray-pink',
    'Коричневая': 'Brown',
    'Золотистая': 'Golden',
    'Серебристая': 'Silver',
    'Пятнистая': 'Spotted',
    'Трёхцветная': 'Tricolor'
  },

  kk: {
    'Голштинская': 'Голштин',
    'Джерсейская': 'Джерси',
    'Симментальская': 'Симментал',
    'Айрширская': 'Айршир',
    'Герефордская': 'Герефорд',
    'Ангусская': 'Ангус',
    'Швицкая': 'Швиц',
    'Калмыцкая': 'Қалмақ',
    'Казахская белоголовая': 'Қазақтың ақбас сиыры',
    'Ярославская': 'Ярославль',
    'Холмогорская': 'Холмогор',
    'Арабская': 'Араб',
    'Ахалтекинская': 'Ахалтеке',
    'Орловский рысак': 'Орлов желісті жылқысы',
    'Английская чистокровная': 'Ағылшынның таза қанды жылқысы',
    'Будённовская': 'Буденный',
    'Донская': 'Дон',
    'Казахская': 'Қазақы',
    'Фризская': 'Фриз',
    'Шетлендский пони': 'Шетланд пониі',
    'Тяжеловоз': 'Ауыр жүк жылқысы',
    'Крупная белая': 'Үлкен ақ',
    'Ландрас': 'Ландрас',
    'Дюрок': 'Дюрок',
    'Пьетрен': 'Пьетрен',
    'Йоркширская': 'Йоркшир',
    'Миргородская': 'Миргород',
    'Беркширская': 'Беркшир',
    'Уржумская': 'Уржум',
    'Леггорн': 'Леггорн',
    'Род-Айленд': 'Род-Айленд',
    'Брама': 'Брама',
    'Кохинхин': 'Кохинхин',
    'Орпингтон': 'Орпингтон',
    'Плимутрок': 'Плимутрок',
    'Минорка': 'Минорка',
    'Суссекс': 'Сассекс',
    'Русская белая': 'Орыс ақ тауығы',
    'Адлерская серебристая': 'Адлер күміс түсті',
    'Австралорп': 'Австралорп',
    'Меринос': 'Меринос',
    'Романовская': 'Романов',
    'Эдильбаевская': 'Еділбай',
    'Гиссарская': 'Гиссар',
    'Дорпер': 'Дорпер',
    'Тексель': 'Тексель',
    'Каракульская': 'Қаракөл',
    'Цигайская': 'Цигай',
    'Суффолк': 'Саффолк',
    'Зааненская': 'Заанен',
    'Нубийская': 'Нубия',
    'Альпийская': 'Альпі',
    'Ламанча': 'Ламанча',
    'Ангорская': 'Ангора',
    'Тоггенбургская': 'Тоггенбург',
    'Оренбургская': 'Орынбор',
    'Придонская': 'Придон',
    'Горьковская': 'Горький',

    'Чёрно-белая': 'Қара ала',
    'Красно-белая': 'Қызыл ала',
    'Рыжая': 'Қызғылт сары',
    'Чёрная': 'Қара',
    'Белая': 'Ақ',
    'Бурая': 'Қоңыр',
    'Пёстрая': 'Ала',
    'Серая': 'Сұр',
    'Гнедая': 'Құба',
    'Вороная': 'Қара торы',
    'Буланая': 'Боз',
    'Соловая': 'Сары',
    'Чалая': 'Бозғылт ала',
    'Пегая': 'Шұбар',
    'Игреневая': 'Жирен',
    'Розовая': 'Қызғылт',
    'Серо-розовая': 'Сұрғылт қызғылт',
    'Коричневая': 'Қоңыр',
    'Золотистая': 'Алтын түсті',
    'Серебристая': 'Күміс түсті',
    'Пятнистая': 'Дақты',
    'Трёхцветная': 'Үш түсті'
  },

  fr: {
    'Голштинская': 'Holstein',
    'Джерсейская': 'Jersiaise',
    'Симментальская': 'Simmental',
    'Айрширская': 'Ayrshire',
    'Герефордская': 'Hereford',
    'Ангусская': 'Angus',
    'Швицкая': 'Brune suisse',
    'Калмыцкая': 'Kalmouke',
    'Казахская белоголовая': 'Blanche kazakhe',
    'Ярославская': 'Iaroslavl',
    'Холмогорская': 'Kholmogory',
    'Арабская': 'Arabe',
    'Ахалтекинская': 'Akhal-téké',
    'Орловский рысак': 'Trotteur Orlov',
    'Английская чистокровная': 'Pur-sang anglais',
    'Будённовская': 'Boudienny',
    'Донская': 'Du Don',
    'Казахская': 'Kazakhe',
    'Фризская': 'Frisonne',
    'Шетлендский пони': 'Poney Shetland',
    'Тяжеловоз': 'Cheval de trait',
    'Крупная белая': 'Large blanche',
    'Ландрас': 'Landrace',
    'Дюрок': 'Duroc',
    'Пьетрен': 'Piétrain',
    'Йоркширская': 'Yorkshire',
    'Миргородская': 'Myrhorod',
    'Беркширская': 'Berkshire',
    'Уржумская': 'Ourjoum',
    'Леггорн': 'Leghorn',
    'Род-Айленд': 'Rhode Island',
    'Брама': 'Brahma',
    'Кохинхин': 'Cochinchine',
    'Орпингтон': 'Orpington',
    'Плимутрок': 'Plymouth Rock',
    'Минорка': 'Minorque',
    'Суссекс': 'Sussex',
    'Русская белая': 'Blanche russe',
    'Адлерская серебристая': 'Adler argentée',
    'Австралорп': 'Australorp',
    'Меринос': 'Mérinos',
    'Романовская': 'Romanov',
    'Эдильбаевская': 'Edilbaï',
    'Гиссарская': 'Hissar',
    'Дорпер': 'Dorper',
    'Тексель': 'Texel',
    'Каракульская': 'Karakul',
    'Цигайская': 'Tsigaï',
    'Суффолк': 'Suffolk',
    'Зааненская': 'Saanen',
    'Нубийская': 'Nubienne',
    'Альпийская': 'Alpine',
    'Ламанча': 'LaMancha',
    'Ангорская': 'Angora',
    'Тоггенбургская': 'Toggenburg',
    'Оренбургская': 'Orenbourg',
    'Придонская': 'Pridonskaïa',
    'Горьковская': 'Gorki',

    'Чёрно-белая': 'Noire et blanche',
    'Красно-белая': 'Rouge et blanche',
    'Рыжая': 'Rousse',
    'Чёрная': 'Noire',
    'Белая': 'Blanche',
    'Бурая': 'Brune',
    'Пёстрая': 'Tachetée',
    'Серая': 'Grise',
    'Гнедая': 'Bai',
    'Вороная': 'Noire',
    'Буланая': 'Isabelle',
    'Соловая': 'Palomino',
    'Чалая': 'Rouanne',
    'Пегая': 'Pie',
    'Игреневая': 'Alezane crins lavés',
    'Розовая': 'Rose',
    'Серо-розовая': 'Gris rosé',
    'Коричневая': 'Marron',
    'Золотистая': 'Dorée',
    'Серебристая': 'Argentée',
    'Пятнистая': 'Tachetée',
    'Трёхцветная': 'Tricolore'
  },

  zh: {
    'Голштинская': '荷斯坦牛',
    'Джерсейская': '泽西牛',
    'Симментальская': '西门塔尔牛',
    'Айрширская': '爱尔夏牛',
    'Герефордская': '赫里福德牛',
    'Ангусская': '安格斯牛',
    'Швицкая': '瑞士褐牛',
    'Калмыцкая': '卡尔梅克牛',
    'Казахская белоголовая': '哈萨克白头牛',
    'Ярославская': '雅罗斯拉夫尔牛',
    'Холмогорская': '霍尔莫戈尔牛',
    'Арабская': '阿拉伯马',
    'Ахалтекинская': '阿哈尔捷金马',
    'Орловский рысак': '奥尔洛夫快步马',
    'Английская чистокровная': '英国纯血马',
    'Будённовская': '布琼尼马',
    'Донская': '顿河马',
    'Казахская': '哈萨克马',
    'Фризская': '弗里斯兰马',
    'Шетлендский пони': '设得兰矮马',
    'Тяжеловоз': '挽马',
    'Крупная белая': '大白猪',
    'Ландрас': '长白猪',
    'Дюрок': '杜洛克猪',
    'Пьетрен': '皮特兰猪',
    'Йоркширская': '约克夏猪',
    'Миргородская': '米尔哥罗德猪',
    'Беркширская': '巴克夏猪',
    'Уржумская': '乌尔茹姆猪',
    'Леггорн': '来航鸡',
    'Род-Айленд': '罗得岛红鸡',
    'Брама': '婆罗门鸡',
    'Кохинхин': '科钦鸡',
    'Орпингтон': '奥品顿鸡',
    'Плимутрок': '普利茅斯岩鸡',
    'Минорка': '米诺卡鸡',
    'Суссекс': '萨塞克斯鸡',
    'Русская белая': '俄罗斯白鸡',
    'Адлерская серебристая': '阿德勒银鸡',
    'Австралорп': '澳洲黑鸡',
    'Меринос': '美利奴羊',
    'Романовская': '罗曼诺夫羊',
    'Эдильбаевская': '埃迪尔巴耶夫羊',
    'Гиссарская': '吉萨尔羊',
    'Дорпер': '多赛特羊',
    'Тексель': '特克塞尔羊',
    'Каракульская': '卡拉库尔羊',
    'Цигайская': '齐盖羊',
    'Суффолк': '萨福克羊',
    'Зааненская': '萨能山羊',
    'Нубийская': '努比亚山羊',
    'Альпийская': '阿尔卑斯山羊',
    'Ламанча': '拉曼查山羊',
    'Ангорская': '安哥拉山羊',
    'Тоггенбургская': '托根堡山羊',
    'Оренбургская': '奥伦堡山羊',
    'Придонская': '普里顿山羊',
    'Горьковская': '高尔基山羊',

    'Чёрно-белая': '黑白色',
    'Красно-белая': '红白色',
    'Рыжая': '红棕色',
    'Чёрная': '黑色',
    'Белая': '白色',
    'Бурая': '棕色',
    'Пёстрая': '杂色',
    'Серая': '灰色',
    'Гнедая': '骝色',
    'Вороная': '黑色',
    'Буланая': '沙色',
    'Соловая': '帕洛米诺色',
    'Чалая': '沙毛色',
    'Пегая': '花斑色',
    'Игреневая': '栗色浅鬃',
    'Розовая': '粉色',
    'Серо-розовая': '灰粉色',
    'Коричневая': '棕色',
    'Золотистая': '金色',
    'Серебристая': '银色',
    'Пятнистая': '斑点色',
    'Трёхцветная': '三色'
  }
};

// Заполнение выпадающего списка

function fillAnimalSelect(selectId, options, placeholder) {
  const select = document.getElementById(selectId);

  if (!select) return;

  const language = getAgroLanguage();
  const ui = animalOptionUiTranslations[language] ||
             animalOptionUiTranslations.ru;

  const translations = animalOptionTranslations[language] || {};

  select.innerHTML = '';

  const firstOption = document.createElement('option');
  firstOption.value = '';
  firstOption.textContent = placeholder;

  select.appendChild(firstOption);

  options.forEach(value => {
    const option = document.createElement('option');

    // Сохраняем оригинальное значение для базы данных
    option.value = value;

    // Переводим только отображаемый текст
    option.textContent = translations[value] || value;

    select.appendChild(option);
  });

  const customOption = document.createElement('option');
  customOption.value = '__custom__';
  customOption.textContent = ui.custom;

  select.appendChild(customOption);
}


// Обновление пород и окрасов при выборе вида животного

function updateAnimalOptions() {
  const species = document.getElementById('animalSpecies').value;
  const options = animalOptions[species];

  if (!options) return;

  const language = getAgroLanguage();
  const ui = animalOptionUiTranslations[language] ||
             animalOptionUiTranslations.ru;

  fillAnimalSelect(
    'animalBreed',
    options.breeds,
    ui.breedPlaceholder
  );

  fillAnimalSelect(
    'animalColor',
    options.colors,
    ui.colorPlaceholder
  );

  document.getElementById('customAnimalBreed').value = '';
  document.getElementById('customAnimalColor').value = '';

  document.getElementById('customAnimalBreed').style.display = 'none';
  document.getElementById('customAnimalColor').style.display = 'none';
}


// Показать поле для собственного значения
function toggleCustomAnimalField(selectId, inputId) {
  const select = document.getElementById(selectId);
  const input = document.getElementById(inputId);

  if (select.value === '__custom__') {
    input.style.display = 'block';
    input.focus();
  } else {
    input.style.display = 'none';
    input.value = '';
  }
}

// Получить выбранную породу или окрас
function getAnimalFieldValue(selectId, inputId) {
  const select = document.getElementById(selectId);

  if (select.value === '__custom__') {
    return document.getElementById(inputId).value.trim();
  }

  return select.value;
}

// Обработчики списков
document.getElementById('animalSpecies').addEventListener(
  'change',
  updateAnimalOptions
);

document.getElementById('animalBreed').addEventListener(
  'change',
  function() {
    toggleCustomAnimalField('animalBreed', 'customAnimalBreed');
  }
);

document.getElementById('animalColor').addEventListener(
  'change',
  function() {
    toggleCustomAnimalField('animalColor', 'customAnimalColor');
  }
);

// Начальные демонстрационные животные.
// Они добавятся только если хранилище ещё пустое.
function initializeAnimals() {
  const saved = localStorage.getItem(ANIMAL_STORAGE);

  if (saved !== null) return;

  const initialAnimals = [
    {
      species: 'cow',
      name: 'Белянка',
      id: 'COW-001',
      breed: 'Голштинская',
      color: 'Чёрно-белая',
      sex: 'Самка',
      birth: '',
      weight: '',
      notes: ''
    },
    {
      species: 'cow',
      name: 'Звёздочка',
      id: 'COW-002',
      breed: 'Джерсейская',
      color: '',
      sex: 'Самка',
      birth: '',
      weight: '',
      notes: ''
    },
    {
      species: 'sheep',
      name: 'Пушинка',
      id: 'SHEEP-001',
      breed: 'Меринос',
      color: '',
      sex: 'Самка',
      birth: '',
      weight: '',
      notes: ''
    },
    {
      species: 'goat',
      name: 'Ромашка',
      id: 'GOAT-001',
      breed: '',
      color: '',
      sex: 'Самка',
      birth: '',
      weight: '',
      notes: ''
    },
    {
      species: 'chicken',
      name: 'Рыжик',
      id: 'HEN-001',
      breed: '',
      color: 'Рыжий',
      sex: 'Самка',
      birth: '',
      weight: '',
      notes: ''
    },
    {
      species: 'cow',
      name: 'Милка',
      id: 'COW-003',
      breed: '',
      color: '',
      sex: 'Самка',
      birth: '',
      weight: '',
      notes: ''
    }
  ];

  localStorage.setItem(ANIMAL_STORAGE, JSON.stringify(initialAnimals));
}

// Получить животных
function getSavedAnimals() {
  try {
    return JSON.parse(localStorage.getItem(ANIMAL_STORAGE)) || [];
  } catch (error) {
    return [];
  }
}

// =====================================
// GPS — СПИСОК ЖИВОТНЫХ ФЕРМЫ
// =====================================
// Переводы GPS и списка животных
const gpsAnimalTranslations = {
  ru: {
    status: '⚪ Подготовлено животных: ',
    stopped: '. GPS-симуляция пока остановлена.',
    empty: 'На ферме пока нет животных.'
  },

  kk: {
    status: '⚪ Дайындалған жануарлар: ',
    stopped: '. GPS-симуляциясы әзірге тоқтатылған.',
    empty: 'Фермада әзірге жануарлар жоқ.'
  },

  en: {
    status: '⚪ Animals prepared: ',
    stopped: '. GPS simulation is currently stopped.',
    empty: 'There are no animals on the farm yet.'
  },

  fr: {
    status: '⚪ Animaux préparés : ',
    stopped: '. La simulation GPS est actuellement arrêtée.',
    empty: 'Il n’y a pas encore d’animaux à la ferme.'
  },

  zh: {
    status: '⚪ 已准备动物：',
    stopped: '。GPS 模拟目前已停止。',
    empty: '农场里还没有动物。'
  }
};
function renderGpsAnimals() {

  const animals = getSavedAnimals();

  const totalElement = document.getElementById('gpsTotalAnimals');
  const activeElement = document.getElementById('gpsActiveAnimals');
  const listElement = document.getElementById('gpsAnimalList');
  const statusElement = document.getElementById('gpsStatus');

  if (totalElement) {
    totalElement.textContent = animals.length;
  }

  // Пока симуляция не запущена, движение не отображается
  if (activeElement) {
    activeElement.textContent = '0';
  }

  if (statusElement) {
  const language = getAgroLanguage();
  const t = gpsAnimalTranslations[language] || gpsAnimalTranslations.ru;

  statusElement.textContent =
    t.status + animals.length + t.stopped;
}

  if (!listElement) return;

  listElement.innerHTML = '';

  if (animals.length === 0) {
  const language = getAgroLanguage();
  const t = gpsAnimalTranslations[language] || gpsAnimalTranslations.ru;

  listElement.textContent = t.empty;
  return;
}

  animals.forEach(animal => {

    const card = document.createElement('div');

    card.style.cssText = `
      display:flex;
      align-items:center;
      gap:12px;
      padding:12px;
      margin-top:10px;
      background:var(--bg);
      border-radius:12px;
    `;

    const image = document.createElement('img');

    // Получаем изображение животного

// Изображения животных для игровой фермы
const farmAnimalImages = {
  cow: 'images/farm/animals/cow.png',
  chicken: 'images/farm/animals/chicken.png',
  sheep: 'images/farm/animals/sheep.png',
  pig: 'images/farm/animals/pig.png',
  horse: 'images/farm/animals/horse.png',
  goat: 'images/farm/animals/goat.png',
  duck: 'images/farm/animals/duck.png',
  turkey: 'images/farm/animals/turkey.png',
  rabbit: 'images/farm/animals/rabbit.png'
};

// Выбираем изображение
image.src =
  farmAnimalImages[animal.species] ||
  animalImages[animal.species] ||
  '';

    image.alt = animalNames[animal.species] || 'Животное';

    image.style.cssText = `
      width:48px;
      height:48px;
      object-fit:contain;
      flex-shrink:0;
    `;

    image.onerror = function() {
      this.style.display = 'none';
    };

    const info = document.createElement('div');
    info.style.flex = '1';

    const name = document.createElement('div');
    name.style.fontWeight = '600';
    name.textContent = animal.name || 'Без имени';

    const species = document.createElement('div');
    species.style.fontSize = '13px';
    species.style.color = 'var(--muted)';
    species.textContent =
      animalNames[animal.species] || 'Животное';

    const id = document.createElement('div');
    id.style.fontSize = '12px';
    id.style.color = 'var(--muted)';
    id.textContent = 'ID: ' + animal.id;

    info.append(name, species, id);

    const gpsIcon = document.createElement('div');
    gpsIcon.textContent = '📡';
    gpsIcon.title = 'Подготовлено к GPS-симуляции';

    card.append(image, info, gpsIcon);

    listElement.appendChild(card);
  });
}

// Сохранить животных
function saveAnimals(animals) {
  localStorage.setItem(ANIMAL_STORAGE, JSON.stringify(animals));
}

// Открыть форму добавления
function openAnimalForm() {
  editingAnimalId = null;

  document.getElementById('animalForm').reset();

  updateAnimalOptions();

  document.querySelector('#animalModal h2').textContent = 'Новое животное';

  document.getElementById('animalModal').classList.add('active');
}

// Закрыть форму добавления
function closeAnimalForm() {
  document.getElementById('animalModal').classList.remove('active');
}

// Показать карточки
function renderAnimals() {
  const container = document.getElementById('animalList');
  const empty = document.getElementById('emptyAnimals');

  if (!container || !empty) return;

  container.innerHTML = '';

  const animals = getSavedAnimals();
const language = getAgroLanguage();
const speciesTranslations =
  animalDetailsTranslations[language] ||
  animalDetailsTranslations.ru;

  const filteredAnimals = currentAnimalFilter === 'all'
    ? animals
    : animals.filter(animal => animal.species === currentAnimalFilter);

  filteredAnimals.forEach(function(animal) {
    const card = document.createElement('div');
    card.className = 'animal-card';

    const image = document.createElement('img');
    image.className = 'animal-image';
    // Получаем изображение животного

// Изображения животных для игровой фермы
const farmAnimalImages = {
  cow: 'images/farm/animals/cow.png',
  chicken: 'images/farm/animals/chicken.png',
  sheep: 'images/farm/animals/sheep.png',
  pig: 'images/farm/animals/pig.png',
  horse: 'images/farm/animals/horse.png',
  goat: 'images/farm/animals/goat.png',
  duck: 'images/farm/animals/duck.png',
  turkey: 'images/farm/animals/turkey.png',
  rabbit: 'images/farm/animals/rabbit.png'
};

// Выбираем изображение
image.src =
  farmAnimalImages[animal.species] ||
  animalImages[animal.species] ||
  '';

    image.alt = animalNames[animal.species] || 'Животное';

    image.onerror = function() {
      this.style.display = 'none';
    };

    const name = document.createElement('div');
    name.className = 'animal-name';
    name.textContent = animal.name;

    const id = document.createElement('div');
    id.className = 'animal-info';
    id.textContent = 'ID: ' + animal.id;

    const species = document.createElement('div');
    species.className = 'animal-info';
    species.textContent = speciesTranslations[animal.species] ||
                      speciesTranslations.unknownAnimal;

    card.append(image, name, id, species);

    card.addEventListener('click', function() {
      openAnimalDetails(animal.id);
    });

    container.appendChild(card);
  });

  empty.style.display = filteredAnimals.length === 0 ? 'block' : 'none';

      renderHomeDashboard();
  renderHealthDashboard();
  renderGpsAnimals();
  renderFarmPaddocks();
}


// =====================================
// ИГРОВАЯ ФЕРМА — АВТОМАТИЧЕСКИЕ ЗАГОНЫ
// =====================================

function renderFarmPaddocks() {

  const grid = document.getElementById('farmPaddockGrid');

  if (!grid) return;

  // Получаем животных из существующей базы
  const animals = getSavedAnimals();

  // Оставляем только уникальные виды
  const uniqueSpecies = [];

  animals.forEach(function(animal) {

    if (
      animal.species &&
      !uniqueSpecies.some(item => item.species === animal.species)
    ) {
      uniqueSpecies.push(animal);
    }

  });

  // Очищаем игровое поле
  grid.innerHTML = '';

  // Показываем сообщение, если животных пока нет
  if (uniqueSpecies.length === 0) {

    const empty = document.createElement('div');

    empty.style.gridColumn = '1 / -1';
    empty.style.textAlign = 'center';
    empty.style.padding = '35px 10px';
    empty.style.color = '#42673a';
    empty.textContent = '🌱 Твоя ферма пока ждёт первых животных!';

    grid.appendChild(empty);

    return;
  }

  // Создаём максимум 9 загонов
  uniqueSpecies.slice(0, 9).forEach(function(animal) {

    const paddock = document.createElement('div');
    paddock.className = 'farm-paddock';
// Рисованный фон деревянного загона
paddock.style.backgroundImage = "url('images/farm/pen.png')";
paddock.style.backgroundSize = '100% 100%';
paddock.style.backgroundPosition = 'center';
paddock.style.backgroundRepeat = 'no-repeat';
    // Изображение животного
    const image = document.createElement('img');

    image.className = 'farm-paddock-animal';
    // Получаем изображение животного

// Изображения животных для игровой фермы
const farmAnimalImages = {
  cow: 'images/farm/animals/cow.png',
  chicken: 'images/farm/animals/chicken.png',
  sheep: 'images/farm/animals/sheep.png',
  pig: 'images/farm/animals/pig.png',
  horse: 'images/farm/animals/horse.png',
  goat: 'images/farm/animals/goat.png',
  duck: 'images/farm/animals/duck.png',
  turkey: 'images/farm/animals/turkey.png',
  rabbit: 'images/farm/animals/rabbit.png'
};

// Выбираем изображение
image.src =
  farmAnimalImages[animal.species] ||
  animalImages[animal.species] ||
  '';

    image.alt = animalNames[animal.species] || 'Животное';

    image.onerror = function() {
      this.style.display = 'none';
    };

    

    // Добавляем элементы в загон
    paddock.append(image, name);

    // При нажатии открываем карточку животного
    paddock.addEventListener('click', function() {
      openAnimalDetails(animal.id);
    });

    paddock.style.cursor = 'pointer';

    grid.appendChild(paddock);

  });

}

// =====================================
// ГЛАВНЫЙ ЭКРАН — ДАННЫЕ О ФЕРМЕ
// =====================================

function renderHomeDashboard() {
  const animals = getSavedAnimals();

  // 1. ОБЩЕЕ КОЛИЧЕСТВО ЖИВОТНЫХ

  const totalElement = document.getElementById('totalAnimalCount');

  if (totalElement) {
    totalElement.textContent = animals.length;
  }

  
// СТАТИСТИКА ЗДОРОВЬЯ НА ГЛАВНОЙ СТРАНИЦЕ

const healthyCount = animals.filter(animal =>
  animal.healthStatus === 'normal' &&
  animal.collarConnected === true
).length;

const attentionCount = animals.filter(animal =>
  ['attention', 'critical', 'treatment'].includes(animal.healthStatus)
).length;

const homeHealthyElement = document.getElementById('homeHealthyCount');
const homeAttentionElement = document.getElementById('homeAttentionCount');

if (homeHealthyElement) {
  homeHealthyElement.textContent = healthyCount;
}

if (homeAttentionElement) {
  homeAttentionElement.textContent = attentionCount;
}

  // 2. ЖИВОТНЫЕ ПО ВИДАМ — ТОЛЬКО КАРТИНКИ
// 2. Старая сцена животных отключена
const farmScene = document.getElementById('farmAnimalScene');

if (farmScene) {
  farmScene.innerHTML = '';
}
  // 3. ТРИ ПОСЛЕДНИХ ДОБАВЛЕННЫХ ЖИВОТНЫХ

  const recentContainer = document.getElementById('recentAnimals');

  if (recentContainer) {
    recentContainer.innerHTML = '';

    const recentAnimals = animals.slice(-3).reverse();

    if (recentAnimals.length === 0) {
      recentContainer.innerHTML =
        '<div class="home-empty">Добавь первое животное на ферму!</div>';
    }

    recentAnimals.forEach(animal => {
      const card = document.createElement('div');

      card.className = 'home-recent-card';

      const image = document.createElement('img');

      // Получаем изображение животного

// Изображения животных для игровой фермы
const farmAnimalImages = {
  cow: 'images/farm/animals/cow.png',
  chicken: 'images/farm/animals/chicken.png',
  sheep: 'images/farm/animals/sheep.png',
  pig: 'images/farm/animals/pig.png',
  horse: 'images/farm/animals/horse.png',
  goat: 'images/farm/animals/goat.png',
  duck: 'images/farm/animals/duck.png',
  turkey: 'images/farm/animals/turkey.png',
  rabbit: 'images/farm/animals/rabbit.png'
};

// Выбираем изображение
image.src =
  farmAnimalImages[animal.species] ||
  animalImages[animal.species] ||
  '';

      image.alt = animalNames[animal.species] || 'Животное';

      image.onerror = function() {
        this.style.display = 'none';
      };

      const name = document.createElement('div');

      name.className = 'animal-name';
      name.textContent = animal.name;

      const species = document.createElement('div');

      species.className = 'animal-info';
      species.textContent = animalNames[animal.species] || 'Животное';

      card.append(image, name, species);

      card.addEventListener('click', function() {
        openAnimalDetails(animal.id);
      });

      recentContainer.appendChild(card);
    });
  }
}

// =====================================
// МОНИТОРИНГ ЗДОРОВЬЯ ЖИВОТНЫХ
// =====================================
// Переводы вкладки «Здоровье животных»
const healthDynamicTranslations = {
  ru: {
    connected: 'Подключено устройств: ',
    disconnected: 'Пока не подключены',
    empty: 'На ферме пока нет животных.',
    unknownAnimal: '🐾 Животное',
    initial: '🟢 Начальный статус — оценка не получена',
    normal: '🟢 В норме по данным ошейника',
    attention: '🟡 Требует внимания',
    critical: '🔴 Критическое предупреждение',
    treatment: '💊 На лечении',
    unknown: '⚪ Статус не определён',
    collarConnected: '📡 Ошейник подключён',
    collarDisconnected: '📡 Ошейник не подключён · Данные датчика отсутствуют'
  },

  kk: {
    connected: 'Қосылған құрылғылар: ',
    disconnected: 'Әзірге қосылмаған',
    empty: 'Фермада әзірге жануарлар жоқ.',
    unknownAnimal: '🐾 Жануар',
    initial: '🟢 Бастапқы күй — бағалау алынбаған',
    normal: '🟢 Жаға деректері бойынша қалыпты',
    attention: '🟡 Назар аудару қажет',
    critical: '🔴 Қауіпті ескерту',
    treatment: '💊 Ем қабылдауда',
    unknown: '⚪ Күйі анықталмаған',
    collarConnected: '📡 Жаға қосылған',
    collarDisconnected: '📡 Жаға қосылмаған · Датчик деректері жоқ'
  },

  en: {
    connected: 'Connected devices: ',
    disconnected: 'Not connected yet',
    empty: 'There are no animals on the farm yet.',
    unknownAnimal: '🐾 Animal',
    initial: '🟢 Initial status — no assessment received',
    normal: '🟢 Normal according to collar data',
    attention: '🟡 Needs attention',
    critical: '🔴 Critical warning',
    treatment: '💊 Under treatment',
    unknown: '⚪ Status unknown',
    collarConnected: '📡 Collar connected',
    collarDisconnected: '📡 Collar not connected · No sensor data available'
  },

  fr: {
    connected: 'Appareils connectés : ',
    disconnected: 'Pas encore connectés',
    empty: 'Il n’y a pas encore d’animaux à la ferme.',
    unknownAnimal: '🐾 Animal',
    initial: '🟢 État initial — aucune évaluation reçue',
    normal: '🟢 État normal selon les données du collier',
    attention: '🟡 Nécessite une attention particulière',
    critical: '🔴 Alerte critique',
    treatment: '💊 En traitement',
    unknown: '⚪ État indéterminé',
    collarConnected: '📡 Collier connecté',
    collarDisconnected: '📡 Collier non connecté · Aucune donnée du capteur'
  },

  zh: {
    connected: '已连接设备：',
    disconnected: '尚未连接',
    empty: '农场里还没有动物。',
    unknownAnimal: '🐾 动物',
    initial: '🟢 初始状态 — 尚未获得评估',
    normal: '🟢 项圈数据显示正常',
    attention: '🟡 需要关注',
    critical: '🔴 严重警告',
    treatment: '💊 正在接受治疗',
    unknown: '⚪ 状态未知',
    collarConnected: '📡 项圈已连接',
    collarDisconnected: '📡 项圈未连接 · 暂无传感器数据'
  }
};
function renderHealthDashboard() {
  const animals = getSavedAnimals();
const language = getAgroLanguage();
const t = healthDynamicTranslations[language] || healthDynamicTranslations.ru;
  const totalElement = document.getElementById('healthTotalCount');
  const normalElement = document.getElementById('healthNormalCount');
  const attentionElement = document.getElementById('healthAttentionCount');
  const collarElement = document.getElementById('healthCollarCount');
  const systemElement = document.getElementById('collarSystemStatus');
  const listElement = document.getElementById('healthAnimalList');

  if (!listElement) return;

  const initialCount = animals.filter(animal =>
    !animal.healthStatus || animal.healthStatus === 'initial'
  ).length;

  const attentionCount = animals.filter(animal =>
    ['attention', 'critical', 'treatment'].includes(animal.healthStatus)
  ).length;

  const collarCount = animals.filter(animal =>
    animal.collarConnected === true
  ).length;

  if (totalElement) totalElement.textContent = animals.length;
  if (normalElement) normalElement.textContent = initialCount;
  if (attentionElement) attentionElement.textContent = attentionCount;
  if (collarElement) collarElement.textContent = collarCount;

  if (systemElement) {
  systemElement.textContent = collarCount > 0
    ? t.connected + collarCount
    : t.disconnected;
}

  listElement.innerHTML = '';

  if (animals.length === 0) {
  listElement.textContent = t.empty;
  return;
}

  animals.forEach(animal => {
    const card = document.createElement('div');
    card.style.padding = '15px';
    card.style.borderBottom = '1px solid var(--border, #e5e5e5)';
    card.style.cursor = 'pointer';

    const name = document.createElement('div');
    name.style.fontWeight = '600';
    name.style.marginBottom = '6px';
    name.textContent =
      (animalNames[animal.species] || '🐾 Животное') +
      ' — ' + animal.name;

    const status = document.createElement('div');
    status.style.marginBottom = '5px';

    const statuses = {
  initial: t.initial,
  normal: t.normal,
  attention: t.attention,
  critical: t.critical,
  treatment: t.treatment
};

    status.textContent =
  statuses[animal.healthStatus || 'initial'] || t.unknown;

    const collar = document.createElement('div');
    collar.style.fontSize = '12px';
    collar.style.color = 'var(--muted, #888)';

    collar.textContent = animal.collarConnected
  ? t.collarConnected
  : t.collarDisconnected;

    card.append(name, status, collar);

    card.addEventListener('click', function() {
      showPage('animals');
      openAnimalDetails(animal.id);
    });

    listElement.appendChild(card);
  });
}

// ПЕРЕХОД К ВЫБРАННОМУ ВИДУ ЖИВОТНЫХ

function openAnimalCategory(species) {
  showPage('animals');

  currentAnimalFilter = species;

  document.querySelectorAll('.animal-filter').forEach(button => {
    button.classList.toggle(
      'active',
      button.dataset.species === species
    );
  });

  renderAnimals();
}


// Фильтрация по виду
function filterAnimals(species, button) {
  currentAnimalFilter = species;

  document.querySelectorAll('.animal-filter').forEach(function(item) {
    item.classList.remove('active');
  });

  button.classList.add('active');

  renderAnimals();
}

// Переводы подробной карточки животного
const animalDetailsTranslations = {
  ru: {
    name: 'Имя',
    species: 'Вид',
    id: 'ID / номер бирки',
    breed: 'Порода',
    color: 'Окрас',
    sex: 'Пол',
    birth: 'Дата рождения',
    weight: 'Вес',
    notes: 'Заметки',
    notSpecified: 'Не указано',
    kg: 'кг',
    female: 'Самка',
    male: 'Самец',
    unknownSex: 'Не указан',
    cow: 'Корова',
    horse: 'Лошадь',
    sheep: 'Овца',
    goat: 'Коза',
    pig: 'Свинья',
    chicken: 'Курица',
    duck: 'Утка',
    turkey: 'Индейка',
    rabbit: 'Кролик',
    unknownAnimal: 'Животное'
  },

  kk: {
    name: 'Аты',
    species: 'Түрі',
    id: 'ID / бирка нөмірі',
    breed: 'Тұқымы',
    color: 'Түсі',
    sex: 'Жынысы',
    birth: 'Туған күні',
    weight: 'Салмағы',
    notes: 'Ескертпелер',
    notSpecified: 'Көрсетілмеген',
    kg: 'кг',
    female: 'Ұрғашы',
    male: 'Еркек',
    unknownSex: 'Көрсетілмеген',
    cow: 'Сиыр',
    horse: 'Жылқы',
    sheep: 'Қой',
    goat: 'Ешкі',
    pig: 'Шошқа',
    chicken: 'Тауық',
    duck: 'Үйрек',
    turkey: 'Күркетауық',
    rabbit: 'Қоян',
    unknownAnimal: 'Жануар'
  },

  en: {
    name: 'Name',
    species: 'Species',
    id: 'ID / Tag number',
    breed: 'Breed',
    color: 'Color',
    sex: 'Sex',
    birth: 'Date of birth',
    weight: 'Weight',
    notes: 'Notes',
    notSpecified: 'Not specified',
    kg: 'kg',
    female: 'Female',
    male: 'Male',
    unknownSex: 'Not specified',
    cow: 'Cow',
    horse: 'Horse',
    sheep: 'Sheep',
    goat: 'Goat',
    pig: 'Pig',
    chicken: 'Chicken',
    duck: 'Duck',
    turkey: 'Turkey',
    rabbit: 'Rabbit',
    unknownAnimal: 'Animal'
  },

  fr: {
    name: 'Nom',
    species: 'Espèce',
    id: 'ID / Numéro de la boucle',
    breed: 'Race',
    color: 'Couleur',
    sex: 'Sexe',
    birth: 'Date de naissance',
    weight: 'Poids',
    notes: 'Remarques',
    notSpecified: 'Non renseigné',
    kg: 'kg',
    female: 'Femelle',
    male: 'Mâle',
    unknownSex: 'Non renseigné',
    cow: 'Vache',
    horse: 'Cheval',
    sheep: 'Mouton',
    goat: 'Chèvre',
    pig: 'Cochon',
    chicken: 'Poulet',
    duck: 'Canard',
    turkey: 'Dinde',
    rabbit: 'Lapin',
    unknownAnimal: 'Animal'
  },

  zh: {
    name: '名称',
    species: '种类',
    id: 'ID / 耳标编号',
    breed: '品种',
    color: '毛色',
    sex: '性别',
    birth: '出生日期',
    weight: '体重',
    notes: '备注',
    notSpecified: '未填写',
    kg: '公斤',
    female: '雌性',
    male: '雄性',
    unknownSex: '未填写',
    cow: '奶牛',
    horse: '马',
    sheep: '绵羊',
    goat: '山羊',
    pig: '猪',
    chicken: '鸡',
    duck: '鸭',
    turkey: '火鸡',
    rabbit: '兔子',
    unknownAnimal: '动物'
  }
};

// Открыть информацию о животном

function openAnimalDetails(id) {
  const animal = getSavedAnimals().find(item => item.id === id);

  if (!animal) return;

  currentAnimalId = id;

  const language = getAgroLanguage();
  const t = animalDetailsTranslations[language] || animalDetailsTranslations.ru;
const optionTranslations =
  animalOptionTranslations[language] || {};
  const content = document.getElementById('animalDetailsContent');
  content.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'animal-details';

  const image = document.createElement('img');

  // Изображения животных для игровой фермы
  const farmAnimalImages = {
    cow: 'images/farm/animals/cow.png',
    chicken: 'images/farm/animals/chicken.png',
    sheep: 'images/farm/animals/sheep.png',
    pig: 'images/farm/animals/pig.png',
    horse: 'images/farm/animals/horse.png',
    goat: 'images/farm/animals/goat.png',
    duck: 'images/farm/animals/duck.png',
    turkey: 'images/farm/animals/turkey.png',
    rabbit: 'images/farm/animals/rabbit.png'
  };

  // Выбираем изображение
  image.src =
    farmAnimalImages[animal.species] ||
    animalImages[animal.species] ||
    '';

  // Название животного на выбранном языке
  const speciesName = t[animal.species] || t.unknownAnimal;

  image.alt = speciesName;

  image.onerror = function() {
    this.style.display = 'none';
  };

  const info = document.createElement('div');
  info.className = 'animal-details-info';

  // Переводим пол, если он записан стандартным значением
  const sexTranslations = {
    female: t.female,
    male: t.male,
    unknown: t.unknownSex,
    'Самка': t.female,
    'Самец': t.male,
    'Не указан': t.unknownSex
  };

  const translatedSex = sexTranslations[animal.sex] || animal.sex;

  const fields = [
    [t.name, animal.name],
    [t.species, speciesName],
    [t.id, animal.id],
    [t.breed, optionTranslations[animal.breed] || animal.breed],
    [t.color, optionTranslations[animal.color] || animal.color],
    [t.sex, translatedSex],
    [t.birth, animal.birth],
    [t.weight, animal.weight ? animal.weight + ' ' + t.kg : ''],
    [t.notes, animal.notes]
    
  ];

  fields.forEach(function(field) {
    const p = document.createElement('p');
    const strong = document.createElement('strong');

    strong.textContent = field[0] + ': ';

    p.appendChild(strong);
    p.appendChild(document.createTextNode(field[1] || t.notSpecified));

    info.appendChild(p);
  });

  wrapper.append(image, info);
  content.appendChild(wrapper);

  document.getElementById('animalDetailsModal').classList.add('active');
}


// Закрыть информацию
function closeAnimalDetails() {
  document.getElementById('animalDetailsModal').classList.remove('active');
  currentAnimalId = null;
}

// Удалить животное
function deleteCurrentAnimal() {
  if (!currentAnimalId) return;

  const confirmed = confirm('Ты действительно хочешь удалить это животное?');

  if (!confirmed) return;

  const animals = getSavedAnimals().filter(function(animal) {
    return animal.id !== currentAnimalId;
  });

  saveAnimals(animals);

  closeAnimalDetails();
  renderAnimals();

  notify('Животное удалено!');
}


// Сохранение нового животного через существующую форму
document.getElementById('animalForm').addEventListener('submit', function(event) {
  event.preventDefault();

  const animal = {
    species: document.getElementById('animalSpecies').value,
    name: document.getElementById('animalName').value.trim(),
    id: document.getElementById('animalId').value.trim(),

    breed: getAnimalFieldValue('animalBreed', 'customAnimalBreed'),
    color: getAnimalFieldValue('animalColor', 'customAnimalColor'),

    sex: document.getElementById('animalSex').value,
    birth: document.getElementById('animalBirth').value,
    weight: document.getElementById('animalWeight').value,
    notes: document.getElementById('animalNotes').value.trim(),

    healthStatus: 'initial',
    healthSource: 'initial',
    collarConnected: false,
    lastHealthUpdate: null
  };

  if (!animal.name || !animal.id) {
    alert('Заполни имя и ID животного!');
    return;
  }

  const animals = getSavedAnimals();

  const duplicate = animals.some(function(item) {
    return item.id.toLowerCase() === animal.id.toLowerCase();
  });

  if (duplicate) {
    alert('Такой ID уже существует!');
    return;
  }

  animals.push(animal);

  saveAnimals(animals);

  closeAnimalForm();

  currentAnimalFilter = 'all';

  document.querySelectorAll('.animal-filter').forEach(function(item) {
    item.classList.remove('active');
  });

  document.querySelector('.animal-filter').classList.add('active');

  renderAnimals();

  notify('Животное успешно добавлено!');
});


// Обновление площади фермы на главной странице
function renderHomeFarmArea() {
  const savedPlots = JSON.parse(
    localStorage.getItem(FARM_PLOTS_STORAGE_KEY) || '[]'
  );

  let totalArea = 0;

  savedPlots.forEach(function(plot) {
    totalArea += Number(plot.area) || 0;
  });

  const formattedArea =
    totalArea.toFixed(2).replace('.', ',') + ' га';

  const homeFarmArea = document.getElementById('homeFarmArea');
  const homeFarmAreaScene = document.getElementById('homeFarmAreaScene');

  if (homeFarmArea) {
    homeFarmArea.textContent = formattedArea;
  }

  if (homeFarmAreaScene) {
    homeFarmAreaScene.textContent = formattedArea;
  }
}


// Запуск
initializeAnimals();
renderAnimals();
renderHomeFarmArea();
// ======================================
// ПРОФИЛЬ ВЛАДЕЛЬЦА ФЕРМЫ
// ======================================

const OWNER_PROFILE_KEY = 'agroanimal_owner_profile';

let selectedOwnerEmoji = '👨‍🌾';
let selectedOwnerPhoto = '';


// Получение сохранённого профиля
function getOwnerProfile() {
  try {
    return JSON.parse(
      localStorage.getItem(OWNER_PROFILE_KEY)
    ) || {};
  } catch (error) {
    return {};
  }
}


// Отображение фотографии или эмодзи
function renderOwnerAvatar(avatar, profile) {
  if (!avatar) return;

  avatar.innerHTML = '';

  if (profile.photo) {
    const img = document.createElement('img');
    img.src = profile.photo;
    img.alt = 'Фото владельца';
    avatar.appendChild(img);
  } else {
    avatar.textContent = profile.emoji || '👨‍🌾';
  }
}


// Обновление информации на сайте
function renderOwnerProfile() {
  const profile = getOwnerProfile();
console.log('Профиль владельца:', profile);
console.log('Название фермы:', profile.farmName);
  const nickname = profile.nickname || 'Моя ферма';
  const farmName = profile.farmName || 'Моя ферма';

  const avatar = document.getElementById('ownerAvatar');
  const nicknameElement = document.getElementById('ownerNickname');
  const farmLabel = document.getElementById('ownerFarmLabel');
  const welcomeTitle = document.getElementById('welcomeFarmTitle');

  renderOwnerAvatar(avatar, profile);

  if (nicknameElement) {
    nicknameElement.textContent = nickname;
  }

  if (farmLabel) {
    farmLabel.textContent = farmName;
  }

  if (welcomeTitle) {
  const language = getAgroLanguage();

  const greetings = {
    ru: 'Добро пожаловать в «' + farmName + '»! 👋',
    kk: '«' + farmName + '» фермасына қош келдіңіз! 👋',
    en: 'Welcome to ' + farmName + '! 👋',
    fr: 'Bienvenue dans « ' + farmName + ' » ! 👋',
    zh: '欢迎来到“' + farmName + '”！👋'
  };

  welcomeTitle.textContent =
    greetings[language] || greetings.ru;
}
}


// Открытие окна профиля
function openOwnerProfile() {
  const profile = getOwnerProfile();

  document.getElementById('ownerNicknameInput').value =
    profile.nickname || '';

  document.getElementById('ownerFirstName').value =
    profile.firstName || '';

  document.getElementById('ownerLastName').value =
    profile.lastName || '';

  document.getElementById('ownerFarmNameInput').value =
    profile.farmName || '';

  document.getElementById('ownerDescriptionInput').value =
    profile.description || '';

  selectedOwnerEmoji = profile.emoji || '👨‍🌾';
  selectedOwnerPhoto = profile.photo || '';

  document.getElementById('ownerPhotoInput').value = '';

  document.getElementById('ownerProfileModal').style.display = 'flex';

}


// Закрытие окна профиля
function closeOwnerProfile() {
  document.getElementById('ownerProfileModal').style.display = 'none';
}


// Выбор эмодзи
document.querySelectorAll('.owner-emoji-option').forEach(function(button) {

  button.addEventListener('click', function() {

    selectedOwnerEmoji = button.dataset.emoji;
    selectedOwnerPhoto = '';

    const preview = document.getElementById('ownerAvatar');

    if (preview) {
      preview.textContent = selectedOwnerEmoji;
    }

    document.querySelectorAll('.owner-emoji-option').forEach(function(item) {
      item.style.border = '1px solid #ddd';
    });

    button.style.border = '2px solid #4d8b3e';

  });

});


// Сжатие фотографии для экономии места
function compressOwnerPhoto(file) {
  return new Promise(function(resolve, reject) {

    const reader = new FileReader();

    reader.onload = function() {

      const image = new Image();

      image.onload = function() {

        const canvas = document.createElement('canvas');

        const maxSize = 600;
        const scale = Math.min(
          1,
          maxSize / Math.max(image.width, image.height)
        );

        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);

        const context = canvas.getContext('2d');

        context.drawImage(
          image,
          0,
          0,
          canvas.width,
          canvas.height
        );

        resolve(canvas.toDataURL('image/jpeg', 0.75));

      };

      image.onerror = reject;
      image.src = reader.result;

    };

    reader.onerror = reject;
    reader.readAsDataURL(file);

  });
}


// Загрузка фотографии
document.getElementById('ownerPhotoInput').addEventListener(
  'change',
  async function(event) {

    const file = event.target.files[0];

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Выбери файл изображения!');
      return;
    }

    try {
      selectedOwnerPhoto = await compressOwnerPhoto(file);

      const preview = document.getElementById('ownerAvatar');

      if (preview) {
        preview.innerHTML = '';

        const img = document.createElement('img');
        img.src = selectedOwnerPhoto;
        img.alt = 'Предпросмотр фотографии';

        preview.appendChild(img);
      }

    } catch (error) {
      alert('Не удалось загрузить фотографию.');
    }

  }
);


// Сохранение профиля
document.getElementById('ownerProfileForm').addEventListener(
  'submit',
  function(event) {

    event.preventDefault();

    const profile = {
      nickname: document.getElementById('ownerNicknameInput').value.trim(),
      firstName: document.getElementById('ownerFirstName').value.trim(),
      lastName: document.getElementById('ownerLastName').value.trim(),
      farmName: document.getElementById('ownerFarmNameInput').value.trim(),
      description: document.getElementById('ownerDescriptionInput').value.trim(),

      emoji: selectedOwnerEmoji,
      photo: selectedOwnerPhoto
    };

    if (!profile.nickname) {
      alert('Введи никнейм!');
      return;
    }

    if (!profile.farmName) {
      alert('Введи название фермы!');
      return;
    }

    try {

      localStorage.setItem(
        OWNER_PROFILE_KEY,
        JSON.stringify(profile)
      );

      renderOwnerProfile();
      closeOwnerProfile();

      notify('Профиль успешно сохранён!');

    } catch (error) {
      alert('Не удалось сохранить профиль. Попробуй выбрать фотографию меньшего размера.');
    }

  }
);


// Загружаем профиль при запуске сайта
renderOwnerProfile();