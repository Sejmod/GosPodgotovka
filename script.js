// Константы
const QUESTIONS_PER_CATEGORY = 20; // По тз 20, но для теста с малым кол-вом вопросов в БД изменим временно
const TOTAL_QUESTIONS = 60; // 20 * 3
const TEST_TIME_MINUTES = 60; // 60 минут на тест

// Состояние приложения
let state = {
    currentTest: [],       // Массив текущих 60 вопросов
    userAnswers: {},       // id_вопроса -> выбранный_ответ
    currentIndex: 0,       // Текущий индекс вопроса (0-59)
    timeRemaining: TEST_TIME_MINUTES * 60,
    timerInterval: null,
    isFinished: false
};

// DOM Элементы
const startScreen = document.getElementById('startScreen');
const quizScreen = document.getElementById('quizScreen');
const resultScreen = document.getElementById('resultScreen');

const startBtn = document.getElementById('startBtn');
const resumeBtn = document.getElementById('resumeBtn');
const nextBtn = document.getElementById('nextBtn');
const prevBtn = document.getElementById('prevBtn');
const finishBtn = document.getElementById('finishBtn');
const restartBtn = document.getElementById('restartBtn');
const themeToggle = document.getElementById('themeToggle');

const questionText = document.getElementById('questionText');
const optionsContainer = document.getElementById('optionsContainer');
const currentQNum = document.getElementById('currentQNum');
const totalQNum = document.getElementById('totalQNum');
const progressBar = document.getElementById('progressBar');
const timerDisplay = document.getElementById('timerDisplay');

// Инициализация при загрузке
window.onload = () => {
    initTheme();
    checkActiveSession();
    
    // В реальных условиях с 300 вопросами раскомментируй проверку ниже:
    // if (questionsDB.lang.length < 20 || questionsDB.geo.length < 20 || questionsDB.hist.length < 20) {
    //     alert("Внимание: В базе недостаточно вопросов для генерации (нужно минимум 20 в каждой категории)!");
    // }
};

// Управление темой
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        themeToggle.textContent = '☀️';
    }
    
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-theme');
        const isDark = document.body.classList.contains('dark-theme');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        themeToggle.textContent = isDark ? '☀️' : '🌙';
    });
}

// Проверка наличия незавершенного теста
function checkActiveSession() {
    const savedState = localStorage.getItem('quizState');
    if (savedState) {
        const parsed = JSON.parse(savedState);
        if (!parsed.isFinished) {
            resumeBtn.classList.remove('hidden');
        }
    }
}

// Утилита для перемешивания массива (Алгоритм Фишера-Йетса)
function shuffleArray(array) {
    let arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// Генерация нового теста
function generateTest() {
    // Получаем историю использованных вопросов
    let usedQuestions = JSON.parse(localStorage.getItem('usedQuestions')) || { lang: [], geo: [], hist: [] };
    let newTest = [];

    const categories = ['lang', 'geo', 'hist'];
    
    categories.forEach(cat => {
        let allQs = questionsDB[cat];
        
        // Фильтруем неиспользованные
        let availableQs = allQs.filter(q => !usedQuestions[cat].includes(q.id));
        
        // ВАЖНО: Если доступных меньше 20 (или нужного количества), сбрасываем историю для этой категории
        // Здесь используем Math.min для защиты от ошибок, если в базе пока меньше 20 вопросов
        let needed = Math.min(QUESTIONS_PER_CATEGORY, allQs.length); 
        
        if (availableQs.length < needed) {
            usedQuestions[cat] = []; // Сброс
            availableQs = [...allQs]; // Берем все заново
        }

        // Перемешиваем и берем нужное количество
        let selected = shuffleArray(availableQs).slice(0, needed);
        
        // Добавляем в историю использованных
        selected.forEach(q => usedQuestions[cat].push(q.id));
        
        newTest = newTest.concat(selected);
    });

    // Сохраняем обновленную историю
    localStorage.setItem('usedQuestions', JSON.stringify(usedQuestions));

    // Перемешиваем итоговые 60 вопросов между собой
    newTest = shuffleArray(newTest);

    // Перемешиваем варианты ответов внутри каждого вопроса
    newTest = newTest.map(q => ({
        ...q,
        options: shuffleArray(q.options)
    }));

    return newTest;
}

// Запуск теста
function startTest(isResume = false) {
    if (isResume) {
        state = JSON.parse(localStorage.getItem('quizState'));
    } else {
        state = {
            currentTest: generateTest(),
            userAnswers: {},
            currentIndex: 0,
            timeRemaining: TEST_TIME_MINUTES * 60,
            isFinished: false
        };
        saveState();
    }

    totalQNum.textContent = state.currentTest.length;
    switchScreen('quizScreen');
    renderQuestion();
    startTimer();
}

// Сохранение прогресса
function saveState() {
    localStorage.setItem('quizState', JSON.stringify(state));
}

// Отображение вопроса
function renderQuestion() {
    const q = state.currentTest[state.currentIndex];
    currentQNum.textContent = state.currentIndex + 1;
    questionText.textContent = q.question;
    
    // Обновляем прогресс бар
    const progressPercent = ((state.currentIndex + 1) / state.currentTest.length) * 100;
    progressBar.style.width = `${progressPercent}%`;

    // Очищаем контейнер опций
    optionsContainer.innerHTML = '';

    const hasAnswered = state.userAnswers.hasOwnProperty(q.id);
    const selectedAnswer = state.userAnswers[q.id];

    q.options.forEach((opt, index) => {
        const label = document.createElement('label');
        label.className = 'option-label';
        
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = 'option';
        input.value = opt;
        
        // Если уже отвечали
        if (hasAnswered) {
            input.disabled = true;
            label.classList.add('locked');
            
            if (opt === selectedAnswer) {
                input.checked = true;
                if (opt === q.correct) {
                    label.classList.add('correct');
                } else {
                    label.classList.add('wrong');
                }
            }
            // Всегда подсвечиваем правильный, если пользователь ошибся
            if (opt === q.correct && selectedAnswer !== q.correct) {
                label.classList.add('correct');
            }
        } else {
            input.addEventListener('change', () => handleAnswer(q.id, opt));
        }

        label.appendChild(input);
        label.appendChild(document.createTextNode(opt));
        optionsContainer.appendChild(label);
    });

    // Настройка кнопок навигации
    prevBtn.disabled = state.currentIndex === 0;
    nextBtn.disabled = state.currentIndex === state.currentTest.length - 1;
}

// Обработка ответа
function handleAnswer(questionId, selectedValue) {
    if (state.userAnswers.hasOwnProperty(questionId)) return; // Защита от двойного клика
    
    state.userAnswers[questionId] = selectedValue;
    saveState();
    renderQuestion(); // Перерисовываем для отображения цветов
}

// Таймер
function startTimer() {
    timerDisplay.classList.remove('hidden');
    updateTimerUI();
    
    clearInterval(state.timerInterval);
    state.timerInterval = setInterval(() => {
        state.timeRemaining--;
        updateTimerUI();
        saveState();

        if (state.timeRemaining <= 0) {
            finishTest();
        }
    }, 1000);
}

function updateTimerUI() {
    let m = Math.floor(state.timeRemaining / 60);
    let s = state.timeRemaining % 60;
    timerDisplay.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// Навигация
prevBtn.addEventListener('click', () => {
    if (state.currentIndex > 0) {
        state.currentIndex--;
        renderQuestion();
        saveState();
    }
});

nextBtn.addEventListener('click', () => {
    if (state.currentIndex < state.currentTest.length - 1) {
        state.currentIndex++;
        renderQuestion();
        saveState();
    }
});

startBtn.addEventListener('click', () => startTest(false));
resumeBtn.addEventListener('click', () => startTest(true));

finishBtn.addEventListener('click', () => {
    const unanswered = state.currentTest.length - Object.keys(state.userAnswers).length;
    if (unanswered > 0) {
        if (!confirm(`Вы не ответили на ${unanswered} вопросов. Точно завершить?`)) return;
    }
    finishTest();
});

restartBtn.addEventListener('click', () => {
    switchScreen('startScreen');
    resumeBtn.classList.add('hidden'); // Прячем кнопку продолжения
});

// Завершение теста и подсчет
function finishTest() {
    clearInterval(state.timerInterval);
    state.isFinished = true;
    timerDisplay.classList.add('hidden');
    saveState(); // Сохраняем статус завершенности

    let correctCount = 0;
    let mistakesHTML = '';

    state.currentTest.forEach(q => {
        const userAnswer = state.userAnswers[q.id];
        if (userAnswer === q.correct) {
            correctCount++;
        } else {
            // Формируем список ошибок
            mistakesHTML += `
                <div class="mistake-item">
                    <p><strong>Вопрос:</strong> ${q.question}</p>
                    <p class="text-red">Ваш ответ: ${userAnswer || 'Не отвечен'}</p>
                    <p class="text-green">Правильный ответ: ${q.correct}</p>
                </div>
            `;
        }
    });

    const total = state.currentTest.length;
    const percent = Math.round((correctCount / total) * 100);
    
    // Оценка
    let grade = "2 (Неудовлетворительно)";
    if (percent >= 85) grade = "5 (Отлично)";
    else if (percent >= 70) grade = "4 (Хорошо)";
    else if (percent >= 50) grade = "3 (Удовлетворительно)";

    // Вывод на экран
    document.getElementById('resCorrect').textContent = correctCount;
    document.getElementById('resWrong').textContent = total - correctCount;
    document.getElementById('resPercent').textContent = percent;
    document.getElementById('resGrade').textContent = grade;
    
    const mistakesList = document.getElementById('mistakesList');
    if (mistakesHTML === '') {
        mistakesList.innerHTML = '<p class="text-green">Ошибок нет! Отличная работа!</p>';
    } else {
        mistakesList.innerHTML = mistakesHTML;
    }

    switchScreen('resultScreen');
}

// Утилита переключения экранов
function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}