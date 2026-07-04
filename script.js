// ================================================
// 1. СТАН ДОДАТКУ
// ================================================
var state = {
    questions: [],
    index: 0,
    score: 0,
    locked: false,
    quizAmount: 5 // Кількість питань для API
};

// ================================================
// 2. ЕЛЕМЕНТИ СТОРІНКИ
// ================================================
var app           = document.getElementById("app");
var screenStart   = document.getElementById("screen-start");
var screenLoading = document.getElementById("screen-loading");
var screenQuiz    = document.getElementById("screen-quiz");
var screenResult  = document.getElementById("screen-result");
var btnStart      = document.getElementById("btn-start");
var btnRestart    = document.getElementById("btn-restart");
var metaQuestions = document.getElementById("meta-questions");
var curNum        = document.getElementById("cur-num");
var totalNum      = document.getElementById("total-num");
var liveScore     = document.getElementById("live-score");
var progressFill  = document.getElementById("progress-fill");
var qCategory     = document.getElementById("q-category");
var qText         = document.getElementById("q-text");
var answersBox    = document.getElementById("answers");
var resultIcon    = document.getElementById("result-icon");
var resultStatus  = document.getElementById("result-status");
var resultTitle   = document.getElementById("result-title");
var resultPct     = document.getElementById("result-pct");
var resultFrac    = document.getElementById("result-frac");
var resultMsg     = document.getElementById("result-msg");
var ringMeter     = document.getElementById("ring-meter");
var confetti      = document.getElementById("confetti");
var loaderText    = document.querySelector(".loader-text");
var loaderSub     = document.querySelector(".loader-sub");

var LETTERS = ["А", "Б", "В", "Г", "Д"];

var ICONS = {
    sad:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
    neutral: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="8" y1="15" x2="16" y2="15"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
    trophy:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>'
};


// ================================================
// 3. ДОПОМІЖНІ ФУНКЦІЇ ДЛЯ API (ДЕКОД ТА ШАФЛ)
// ================================================
function shuffleArray(array) {
    var arr = array.slice();
    for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = arr[i]; arr[i] = arr[j]; arr[j] = temp;
    }
    return arr;
}

function decodeHTML(html) {
    var txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
}


// ================================================
// 4. ІНТЕГРАЦІЯ GOOGLE TRANSLATE (АВТОПЕРЕКЛАД)
// ================================================
// Запит до прихованого API Google Translate
async function autoTranslateUK(textArr) {
    // З'єднуємо питання через подвійний відступ (найнадійніший сепаратор для перекладу батчем)
    var textCombined = textArr.join('\n \n');
    var url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=uk&dt=t&q=" + encodeURIComponent(textCombined);
    
    let res = await fetch(url);
    let data = await res.json();
    
    // Складаємо отримані сегменти тексту назад
    let fullTranslation = "";
    for (let chunk of data[0]) { fullTranslation += chunk[0]; }
    
    // Розбиваємо назад на масив (регулярний вираз на випадок зміщення перекладом пробілів)
    return fullTranslation.split(/\n\s*\n/).map(s => s.trim());
}


// ================================================
// 5. ОСНОВНЕ ЗАВАНТАЖЕННЯ ДАНИХ (ПЛЮС ПЕРЕКЛАД)
// ================================================
async function fetchQuestions() {
    var apiUrl = "https://opentdb.com/api.php?amount=" + state.quizAmount + "&category=12&type=multiple";
    
    loaderText.innerHTML = 'Підключення до бази знань<span class="dots"></span>';
    loaderSub.textContent = "GET " + apiUrl;

    try {
        let res = await fetch(apiUrl);
        let data = await res.json();
        
        if (data.response_code !== 0 || data.results.length === 0) {
            throw new Error("База пуста");
        }

        // КРОК 1. Розпакуємо питання (очищаємо від спецсимволів типу &#039)
        let parsedBatch = data.results.map(item => {
            let options = item.incorrect_answers.map(decodeHTML);
            let correctAnswer = decodeHTML(item.correct_answer);
            options.push(correctAnswer);
            let shuffled = shuffleArray(options);

            return {
                origCat: decodeHTML(item.category),
                origQue: decodeHTML(item.question),
                origShuffledAnswers: shuffled,
                correctIdx: shuffled.indexOf(correctAnswer)
            };
        });

        loaderText.innerHTML = 'Англомовні дані знайдено. Перекладаємо<span class="dots"></span>';
        loaderSub.textContent = "Google Translation Engine...";

        // КРОК 2. Пакуємо все в один єдиний масив для швидкого перекладу
        let stringBucket = [];
        parsedBatch.forEach(q => {
            stringBucket.push(q.origCat);
            stringBucket.push(q.origQue);
            stringBucket.push(...q.origShuffledAnswers);
        });

        // Виконуємо запит до перекладача
        let translatedBucket = await autoTranslateUK(stringBucket);

        // КРОК 3. Збираємо отриманий український текст назад в об'єкти питань
        let finalQuestions = [];
        let ptr = 0; // вказівник у перекладеному масиві

        for (let idx = 0; idx < parsedBatch.length; idx++) {
            let catTrans = translatedBucket[ptr++];
            let queTrans = translatedBucket[ptr++];
            let ansTrans = [
                translatedBucket[ptr++],
                translatedBucket[ptr++],
                translatedBucket[ptr++],
                translatedBucket[ptr++]
            ];

            // Застрахуємося: якщо переклад зламався, повернемо оригінал
            finalQuestions.push({
                category: catTrans || parsedBatch[idx].origCat,
                question: queTrans || parsedBatch[idx].origQue,
                answers: ansTrans.every(v => v !== undefined) ? ansTrans : parsedBatch[idx].origShuffledAnswers,
                correct: parsedBatch[idx].correctIdx
            });
        }
        
        return finalQuestions;

    } catch(err) {
        // ЯКЩО зник Інтернет або ліміт гугла вичерпаний: Фолбек на гарантовано український варіант
        console.warn("Помилка зв'язку або перекладу. Фолбек", err);
        return [
            { category: "Резерв", question: "Якому музичному гурту належить легендарна пісня «Bohemian Rhapsody»?", answers: ["The Beatles", "Rolling Stones", "Queen", "Nirvana"], correct: 2 },
            { category: "Український Рок", question: "Хто є незмінним лідером гурту «Океан Ельзи»?", answers: ["Скрябін", "Олег Скрипка", "Святослав Вакарчук", "Бумбокс"], correct: 2 },
            { category: "Теорія", question: "Скільки клавіш має стандартне фортепіано?", answers: ["64", "76", "88", "104"], correct: 2 },
            { category: "Класика", question: "Який видатний композитор втратив слух?", answers: ["Бах", "Моцарт", "Бетховен", "Вівальді"], correct: 2 },
            { category: "Поп Музика", question: "Хто заспівав найпрослуховуванішу новорічну пісню «All I Want for Christmas Is You»?", answers: ["Мерайя Кері", "Леді Гага", "Мадонна", "Селін Діон"], correct: 0 }
        ];
    }
}


// ================================================
// 6. СТАРТ ТА ПЕРЕКЛЮЧЕННЯ
// ================================================
function showScreen(name) {
    screenStart.classList.remove("active"); screenLoading.classList.remove("active");
    screenQuiz.classList.remove("active"); screenResult.classList.remove("active");

    if (name === "start") screenStart.classList.add("active");
    if (name === "loading") screenLoading.classList.add("active");
    if (name === "quiz") screenQuiz.classList.add("active");
    if (name === "result") screenResult.classList.add("active");
}

function startQuiz() {
    showScreen("loading");

    fetchQuestions().then(function(data) {
        state.questions = data;
        state.index = 0;
        state.score = 0;
        state.locked = false;
        totalNum.textContent = data.length;
        app.classList.remove("tier-low", "tier-mid", "tier-high");
        renderQuestion();
        showScreen("quiz");
    });
}


// ================================================
// 7. РЕНДЕР ТА ВІДПОВІДІ
// ================================================
function renderQuestion() {
    var q = state.questions[state.index];
    state.locked = false;

    curNum.textContent    = state.index + 1;
    liveScore.textContent = state.score;
    qCategory.textContent = q.category;
    qText.textContent     = q.question;

    var pct = (state.index / state.questions.length) * 100;
    progressFill.style.width = pct + "%";
    answersBox.innerHTML = "";

    for (var i = 0; i < q.answers.length; i++) {
        var btn = document.createElement("button");
        btn.className = "answer";
        btn.type = "button";
        btn.innerHTML =
            '<span class="marker">' + LETTERS[i] + '</span>' +
            '<span class="answer-text"></span>' +
            '<svg class="check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
        btn.querySelector(".answer-text").textContent = q.answers[i];
        btn.addEventListener("click", makeHandler(i, btn));
        answersBox.appendChild(btn);
    }
}

function makeHandler(i, btn) {
    return function() { handleAnswer(i, btn); };
}

function handleAnswer(chosen, btnEl) {
    if (state.locked) return;
    state.locked = true;

    var q = state.questions[state.index];
    var buttons = answersBox.querySelectorAll(".answer");

    if (chosen === q.correct) {
        state.score++;
        liveScore.textContent = state.score;
        btnEl.classList.add("correct");
    } else {
        btnEl.classList.add("wrong");
        buttons[q.correct].classList.add("correct");
    }

    for (var i = 0; i < buttons.length; i++) {
        buttons[i].setAttribute("disabled", "true");
        if (i !== chosen && i !== q.correct) buttons[i].classList.add("dim");
    }

    setTimeout(function() {
        state.index++;
        if (state.index < state.questions.length) {
            renderQuestion();
        } else {
            progressFill.style.width = "100%";
            setTimeout(showResult, 350);
        }
    }, 1100);
}


// ================================================
// 8. РЕЗУЛЬТАТИ ТА ФІНАЛ
// ================================================
function getTier(percent) {
    if (percent < 40) return { tier: "tier-low",  status: "Слухач",     title: "Варто поповнити плейлист", msg: "Звучить так, ніби твій фокус на інших темах!",        icon: ICONS.sad     };
    if (percent < 80) return { tier: "tier-mid",  status: "Меломан",    title: "Чудовий ритм!",            msg: "Ти непогано орієнтуєшся у світі популярної музики.",    icon: ICONS.neutral  };
    return            { tier: "tier-high", status: "Маестро",    title: "Ти Музичний Геній!",       msg: "Просто ідеально! Знанням позаздрять професіонали.",       icon: ICONS.trophy   };
}

function showResult() {
    var total   = state.questions.length;
    var percent = Math.round((state.score / total) * 100);
    var t       = getTier(percent);

    app.classList.remove("tier-low", "tier-mid", "tier-high");
    app.classList.add(t.tier);

    resultIcon.innerHTML     = t.icon;
    resultStatus.textContent = t.status;
    resultTitle.textContent  = t.title;
    resultMsg.textContent    = t.msg;
    resultFrac.textContent   = state.score + " / " + total;
    resultPct.textContent    = percent + "%";

    showScreen("result");
    ringMeter.style.strokeDashoffset = 471;
    setTimeout(() => { ringMeter.style.strokeDashoffset = 471 * (1 - percent / 100); }, 100);
    
    confetti.innerHTML = "";
    if (t.tier === "tier-high") launchConfetti();
}

function launchConfetti() {
    var colors = ["#2dd4a7", "#9d8bff", "#ffa53b", "#ffffff", "#7c6cff"];
    for (var i = 0; i < 36; i++) {
        var piece = document.createElement("i");
        piece.style.left = Math.random() * 100 + "%";
        piece.style.background = colors[i % colors.length];
        piece.style.animationDelay = Math.random() * 0.6 + "s";
        piece.style.animationDuration = (2 + Math.random() * 1.4) + "s";
        piece.style.borderRadius = Math.random() > 0.5 ? "50%" : "2px";
        piece.style.width = piece.style.height = (6 + Math.random() * 8) + "px";
        confetti.appendChild(piece);
    }
}

// ================================================
// 9. ПОДІЇ + ІНІЦІАЛІЗАЦІЯ
// ================================================
function restart() {
    app.classList.remove("tier-low", "tier-mid", "tier-high");
    confetti.innerHTML = "";
    showScreen("start"); // Відкидаємо у початкове меню, щоб він обрав стартувати знову з новою серією API
}

btnStart.addEventListener("click", startQuiz);
btnRestart.addEventListener("click", restart);

metaQuestions.textContent = state.quizAmount;

