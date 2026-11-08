async function loadPartial(file, containerId) {
  const response = await fetch(file);

  if (!response.ok) {
  throw new Error(
    `Ошибка ${response.status}: ${file}`
  );
}

  const html = await response.text();

  document.getElementById(containerId).insertAdjacentHTML(
    'beforeend',
    html
  );
}

async function startApp() {
    if (window.agroAnimalProStarted) {
    return;
  }

  window.agroAnimalProStarted = true;
  try {
    const pages = [
      'pages/home.html',
      'pages/animals.html',
      'pages/territory.html',
      'pages/health.html',
      'pages/ai.html',
      'pages/genetics.html',
      'pages/community.html'
    ];

    for (const file of pages) {
  await loadPartial(file, 'pages-container');
}

    await loadPartial(
      'components/modals.html',
      'modals-container'
    );

    
    // Сначала загружаем систему переводов
    const translationsScript = document.createElement('script');
    translationsScript.src = 'js/translations.js';

    translationsScript.onload = () => {

      // После переводов загружаем основное приложение
      const script = document.createElement('script');
      script.src = 'js/app.js';

      script.onload = () => {
        console.log('AgroAnimalProAI запущен!');
      };

      script.onerror = () => {
        alert('Не удалось загрузить js/app.js');
      };

      document.body.appendChild(script);
    };

    translationsScript.onerror = () => {
      alert('Не удалось загрузить js/translations.js');
    };

    document.body.appendChild(translationsScript);


  } catch (error) {
    console.error('Ошибка загрузки сайта:', error);
    alert('Не удалось загрузить страницы. Проверь названия файлов и папок.');
  }
}

document.addEventListener('DOMContentLoaded', startApp);