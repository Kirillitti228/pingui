import React, { useEffect, useRef, useState } from "react";
import { lessons } from "./lessonData.js";
import questionBank from "./questionBank.js";
import { languages, skillIcons, skillKeys } from "./translations.js";
import VocabularyPage from "./VocabularyPage.jsx";
import Penguin from "./Penguin.jsx";

const STORAGE_KEY = "pingui-learning-progress";
const languageTags = { English: "en", Norwegian: "nb", Russian: "ru", Ukrainian: "uk" };
const levelRank = { beginner: 0, elementary: 1, intermediate: 2, upperIntermediate: 3 };
const levels = ["beginner", "elementary", "intermediate", "upperIntermediate"];
const levelUnlockXp = { beginner: 0, elementary: 40, intermediate: 120, upperIntermediate: 240 };
const catalog = [
  ...lessons.flatMap((lesson) => lesson.questions.map((question, index) => ({
    ...question,
    id: question.id || `starter-${lesson.id}-${index}`,
    skill: lesson.id,
    level: "beginner",
    topic: lesson.id === "writing" ? "communication" : lesson.id,
  }))),
  ...questionBank,
];
const emptyProgress = {
  xp: 0,
  lessons: 0,
  totalAnswered: 0,
  totalCorrect: 0,
  streak: 0,
  lastActive: "",
  dailyXp: 0,
  dailyDate: "",
  activity: {},
  skills: {},
  missedQuestions: [],
  seenQuestions: [],
  completedTopics: [],
};

function getDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getPreviousDateKey() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return getDateKey(yesterday);
}

function getWeekActivity(activity, locale) {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const key = getDateKey(date);
    return {
      key,
      label: date.toLocaleDateString(locale, { weekday: "short" }),
      xp: activity[key]?.xp || 0,
      isToday: key === getDateKey(),
    };
  });
}

function readSavedState() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return { storageError: false, savedWords: [], learnedWords: [] };
    const parsed = JSON.parse(saved);
    if (!parsed || typeof parsed !== "object") throw new Error("Invalid saved progress");
    const savedProgress = parsed.progress || {};
    const savedXp = Number.isFinite(savedProgress.xp) ? savedProgress.xp : 0;
    const highestUnlockedLevel = levels.filter((level) => savedXp >= levelUnlockXp[level]).at(-1) || "beginner";
    return {
      storageError: false,
      language: languages[parsed.language] ? parsed.language : "English",
      name: typeof parsed.name === "string" ? parsed.name : "Alex",
      dailyGoal: [20, 30, 50].includes(parsed.dailyGoal) ? parsed.dailyGoal : 30,
      learningLevel: levels.includes(parsed.learningLevel)
        && levelRank[parsed.learningLevel] <= levelRank[highestUnlockedLevel]
        ? parsed.learningLevel
        : highestUnlockedLevel,
      soundsEnabled: typeof parsed.soundsEnabled === "boolean" ? parsed.soundsEnabled : false,
      animationsEnabled: typeof parsed.animationsEnabled === "boolean" ? parsed.animationsEnabled : true,
      savedWords: Array.isArray(parsed.savedWords) ? parsed.savedWords.filter((word) => typeof word === "string") : [],
      learnedWords: Array.isArray(parsed.learnedWords) ? parsed.learnedWords.filter((word) => typeof word === "string") : [],
      progress: {
        ...emptyProgress,
        ...savedProgress,
        activity: savedProgress.activity || {},
        skills: savedProgress.skills || {},
        missedQuestions: Array.isArray(savedProgress.missedQuestions) ? savedProgress.missedQuestions : [],
        seenQuestions: Array.isArray(savedProgress.seenQuestions) ? savedProgress.seenQuestions : [],
        completedTopics: Array.isArray(savedProgress.completedTopics) ? savedProgress.completedTopics : [],
      },
    };
  } catch {
    return { storageError: true, savedWords: [], learnedWords: [] };
  }
}

function normalizeAnswer(value) {
  return value.trim().toLowerCase().replace(/[.!?,'""]/g, "").replace(/\s+/g, " ");
}

function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function chooseLessonQuestions(skillId, level, progress, reviewOnly = false, topicId = "") {
  const missed = new Set(progress.missedQuestions || []);
  const seen = new Set(progress.seenQuestions || []);
  const eligible = catalog.filter((question) => {
    const levelAllowed = levelRank[question.level] <= levelRank[level];
    return levelAllowed && (reviewOnly ? missed.has(question.id) : question.skill === skillId && (!topicId || question.topic === topicId));
  });
  const reviewed = shuffle(eligible.filter((question) => missed.has(question.id)));
  if (reviewOnly) return reviewed.slice(0, 5).map((question) => ({
    ...question,
    wordBank: question.wordBank ? shuffle(question.wordBank) : undefined,
  }));

  const unseen = shuffle(eligible.filter((question) => !seen.has(question.id) && !missed.has(question.id)));
  const previouslySeen = shuffle(eligible.filter((question) => seen.has(question.id) && !missed.has(question.id)));
  const selectedQuestions = [];
  const selectedIds = new Set();
  const selectedTypes = new Set();
  const addDistinctType = (question) => {
    if (selectedQuestions.length >= 5 || selectedIds.has(question.id) || selectedTypes.has(question.type)) return false;
    selectedQuestions.push(question);
    selectedIds.add(question.id);
    selectedTypes.add(question.type);
    return true;
  };
  reviewed.slice(0, 2).forEach(addDistinctType);
  unseen.forEach(addDistinctType);
  previouslySeen.forEach(addDistinctType);
  return selectedQuestions.slice(0, 5).map((question) => ({
    ...question,
    wordBank: question.wordBank ? shuffle(question.wordBank) : undefined,
  }));
}

function getOptions(question, language, t) {
  if (question.type === "translateToInterface") {
    return question.optionsByLanguage[language].map((value) => ({
      value,
      label: value,
      correct: value === question.answerByLanguage[language],
    }));
  }
  if (question.type === "trueFalse") {
    return [
      { value: "true", label: t.true },
      { value: "false", label: t.false },
    ];
  }
  if (question.type === "pronunciation" && question.options?.includes("I said it clearly")) {
    return [
      { value: "I said it clearly", label: t.saidIt },
      { value: "Let me try again", label: t.trySpeakingAgain },
    ];
  }
  return (question.options || []).map((value) => ({ value, label: value }));
}

function getAchievements(progress) {
  return [
    { id: "firstLesson", icon: "🐣", unlocked: progress.lessons >= 1 },
    { id: "wordExplorer", icon: "📚", unlocked: progress.xp >= 100 },
    { id: "weekWarrior", icon: "🔥", unlocked: progress.streak >= 3 },
    { id: "perfectLesson", icon: "⭐", unlocked: progress.totalCorrect >= 5 },
  ];
}

function StatCard({ icon, label, value, tone = "lilac", detail }) {
  return (
    <article className="stat-card">
      <span className={`stat-icon ${tone}`} aria-hidden="true">{icon}</span>
      <div className="stat-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        {detail && <small>{detail}</small>}
      </div>
    </article>
  );
}

export default function App() {
  const [initialState] = useState(readSavedState);
  const [language, setLanguage] = useState(initialState.language || "English");
  const [name, setName] = useState(initialState.name || "Alex");
  const [nameDraft, setNameDraft] = useState(initialState.name || "Alex");
  const [dailyGoal, setDailyGoal] = useState(initialState.dailyGoal || 30);
  const [learningLevel, setLearningLevel] = useState(initialState.learningLevel || "beginner");
  const [soundsEnabled, setSoundsEnabled] = useState(initialState.soundsEnabled || false);
  const [animationsEnabled, setAnimationsEnabled] = useState(initialState.animationsEnabled ?? true);
  const [progress, setProgress] = useState(initialState.progress || emptyProgress);
  const [savedWords, setSavedWords] = useState(initialState.savedWords || []);
  const [learnedWords, setLearnedWords] = useState(initialState.learnedWords || []);
  const [storageError, setStorageError] = useState(initialState.storageError);
  const [page, setPage] = useState("home");
  const [activeSkill, setActiveSkill] = useState("vocabulary");
  const [lessonQuestions, setLessonQuestions] = useState([]);
  const [reviewOnly, setReviewOnly] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const [matches, setMatches] = useState({});
  const [selectedWord, setSelectedWord] = useState("");
  const [answered, setAnswered] = useState(false);
  const [session, setSession] = useState([]);
  const [sessionXp, setSessionXp] = useState(0);
  const [characterState, setCharacterState] = useState("idle");
  const [newAchievement, setNewAchievement] = useState("");
  const [speechIssue, setSpeechIssue] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [pendingPage, setPendingPage] = useState("");
  const answerLock = useRef(false);
  const transitionLock = useRef(false);
  const nameSavedTimer = useRef(null);

  const t = languages[language];
  const currentQuestion = lessonQuestions[questionIndex];
  const correctCount = session.filter((item) => item.correct).length;
  const accuracy = progress.totalAnswered
    ? Math.round((progress.totalCorrect / progress.totalAnswered) * 100)
    : 0;
  const level = Math.floor(progress.xp / 100) + 1;
  const levelProgress = progress.xp % 100;
  const activeBadges = getAchievements(progress).filter((badge) => badge.unlocked);
  const dailyXp = progress.dailyDate === getDateKey() ? progress.dailyXp : 0;
  const goalPercent = Math.min(100, Math.round((dailyXp / dailyGoal) * 100));
  const missedCount = progress.missedQuestions?.length || 0;
  const visibleSkill = currentQuestion?.skill || activeSkill;

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ language, name, dailyGoal, learningLevel, soundsEnabled, animationsEnabled, progress, savedWords, learnedWords }),
      );
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [language, name, dailyGoal, learningLevel, soundsEnabled, animationsEnabled, progress, savedWords, learnedWords]);

  useEffect(() => {
    document.documentElement.lang = languageTags[language];
  }, [language]);

  useEffect(() => {
    document.documentElement.classList.toggle("pingui-motion-off", !animationsEnabled);
  }, [animationsEnabled]);

  useEffect(() => {
    answerLock.current = false;
    transitionLock.current = false;
  }, [questionIndex]);

  useEffect(() => {
    if (characterState === "idle" || characterState === "sleeping") return undefined;
    const timer = window.setTimeout(() => {
      setCharacterState(page === "complete" ? "dancing" : page === "lesson" ? "learning" : "idle");
    }, characterState === "sad" ? 1600 : 2400);
    return () => window.clearTimeout(timer);
  }, [characterState, page]);

  useEffect(() => {
    if (page !== "home") return undefined;
    const sleepTimer = window.setTimeout(() => setCharacterState("sleeping"), 32000);
    return () => window.clearTimeout(sleepTimer);
  }, [page]);

  useEffect(() => {
    if (!newAchievement) return undefined;
    const timer = window.setTimeout(() => setNewAchievement(""), 4200);
    return () => window.clearTimeout(timer);
  }, [newAchievement]);

  useEffect(() => () => window.clearTimeout(nameSavedTimer.current), []);

  function playSound(kind) {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!soundsEnabled || !AudioContextConstructor) return;
    try {
    const context = new AudioContextConstructor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const notes = kind === "correct" ? [660, 880] : kind === "incorrect" ? [330, 260] : [523, 659, 784];
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(notes[0], context.currentTime);
    notes.slice(1).forEach((note, index) => {
      oscillator.frequency.setValueAtTime(note, context.currentTime + (index + 1) * 0.11);
    });
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + notes.length * 0.11 + 0.18);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + notes.length * 0.11 + 0.2);
    oscillator.onended = () => context.close();
    } catch {
      // Audio is optional; a browser audio restriction must not interrupt a lesson.
    }
  }

  function startLesson(skillId, onlyMissed = false, topicId = "", levelOverride = learningLevel) {
    if (page === "lesson" && !showLeaveConfirm) return;
    const selectedQuestions = chooseLessonQuestions(skillId, levelOverride, progress, onlyMissed, topicId);
    if (!selectedQuestions.length) return;
    setLessonQuestions(selectedQuestions);
    setReviewOnly(onlyMissed);
    setActiveSkill(selectedQuestions[0].skill);
    setQuestionIndex(0);
    setSelected("");
    setMatches({});
    setSelectedWord("");
    setAnswered(false);
    answerLock.current = false;
    transitionLock.current = false;
    setSession([]);
    setSessionXp(0);
    setSpeechIssue(false);
    setNewAchievement("");
    setCharacterState("learning");
    setPage("lesson");
  }

  function updateActivity(oldProgress, dateKey, xpEarned, skillId) {
    const day = oldProgress.activity[dateKey] || { xp: 0, answers: 0, skills: {} };
    return {
      ...oldProgress.activity,
      [dateKey]: {
        xp: day.xp + xpEarned,
        answers: day.answers + 1,
        skills: {
          ...day.skills,
          [skillId]: (day.skills[skillId] || 0) + 1,
        },
      },
    };
  }

  function submitAnswer() {
    if (answered || answerLock.current || page !== "lesson" || !currentQuestion) return;
    const questionSkill = currentQuestion.skill || activeSkill;
    const isMatch = currentQuestion.type === "match";
    const hasResponse = isMatch
      ? Object.keys(matches).length === currentQuestion.pairs.length
      : Array.isArray(selected)
        ? selected.length > 0
        : Boolean(selected.trim());
    if (!hasResponse) return;

    const correctAnswer = currentQuestion.type === "translateToInterface"
      ? currentQuestion.answerByLanguage[language]
      : currentQuestion.answer;
    const correct = isMatch
      ? currentQuestion.pairs.every((pair) => matches[pair.word] === pair.meaning)
      : currentQuestion.type === "arrange" || currentQuestion.type === "buildSentence"
          ? normalizeAnswer(selected.join(" ")) === normalizeAnswer(currentQuestion.answer)
          : currentQuestion.acceptedAnswers
            ? currentQuestion.acceptedAnswers.some((answer) => normalizeAnswer(selected) === normalizeAnswer(answer))
            : normalizeAnswer(selected) === normalizeAnswer(correctAnswer);
    answerLock.current = true;
    setAnswered(true);
    setSession((items) => [...items, { correct }]);
    const updatedSeen = [...new Set([...(progress.seenQuestions || []), currentQuestion.id])].slice(-200);
    const updatedMissed = correct
      ? (progress.missedQuestions || []).filter((id) => id !== currentQuestion.id)
      : [...new Set([...(progress.missedQuestions || []), currentQuestion.id])];
    const levelReached = levelRank[learningLevel];
    const earnedBadge = correct && !getAchievements(progress).find((badge) => badge.id === "perfectLesson")?.unlocked
      && progress.totalCorrect + 1 >= 5
      ? t.brilliantEffort
      : correct && progress.xp < 100 && progress.xp + 10 >= 100
        ? t.wordExplorer
        : "";
    setCharacterState(earnedBadge ? "dancing" : correct ? "happy" : "sad");
    playSound(correct ? "correct" : "incorrect");
    if (earnedBadge) {
      setNewAchievement(earnedBadge);
      playSound("achievement");
    }
    setProgress((old) => {
      const today = getDateKey();
      const activeDate = old.lastActive;
      const streak = activeDate === today
        ? old.streak
        : activeDate === getPreviousDateKey()
          ? old.streak + 1
          : 1;
      const earned = correct ? 10 : 0;
      return {
        ...old,
        xp: old.xp + earned,
        totalAnswered: old.totalAnswered + 1,
        totalCorrect: old.totalCorrect + (correct ? 1 : 0),
        streak,
        lastActive: today,
        dailyXp: (old.dailyDate === today ? old.dailyXp : 0) + earned,
        dailyDate: today,
        activity: updateActivity(old, today, earned, questionSkill),
        seenQuestions: updatedSeen,
        missedQuestions: updatedMissed,
        skills: {
          ...old.skills,
          [questionSkill]: {
            answered: (old.skills[questionSkill]?.answered || 0) + 1,
            correct: (old.skills[questionSkill]?.correct || 0) + (correct ? 1 : 0),
          },
        },
      };
    });
    if (correct) setSessionXp((xp) => xp + 10);
    if ((progress.totalAnswered + 1) % 10 === 0) setCharacterState("encouraging");
    if (levelReached < 3 && progress.xp + (correct ? 10 : 0) >= Object.values(levelUnlockXp)[levelReached + 1]) {
      setNewAchievement(t.newStage);
      setCharacterState("excited");
    }
  }

  function completeLesson() {
    if (transitionLock.current || page !== "lesson") return;
    transitionLock.current = true;
    const today = getDateKey();
    const bonusXp = 10;
    const unlockedFirstLesson = progress.lessons === 0;
    const completedTopics = [...new Set(lessonQuestions.map((question) => question.topic || question.skill))];
    setProgress((old) => ({
      ...old,
      xp: old.xp + bonusXp,
      lessons: old.lessons + 1,
      completedTopics: [...new Set([...(old.completedTopics || []), ...completedTopics])],
      dailyXp: (old.dailyDate === today ? old.dailyXp : 0) + bonusXp,
      dailyDate: today,
      activity: {
        ...old.activity,
        [today]: {
          ...(old.activity[today] || { xp: 0, answers: 0, skills: {} }),
          xp: (old.activity[today]?.xp || 0) + bonusXp,
        },
      },
    }));
    if (unlockedFirstLesson) {
      setNewAchievement(t.firstLesson);
      playSound("achievement");
    }
    setCharacterState(unlockedFirstLesson || correctCount === lessonQuestions.length ? "dancing" : "excited");
    playSound("complete");
    setPage("complete");
  }

  function nextQuestion() {
    if (!answered || transitionLock.current || page !== "lesson") return;
    if (questionIndex === lessonQuestions.length - 1) {
      completeLesson();
      return;
    }
    transitionLock.current = true;
    setQuestionIndex((index) => index + 1);
    setActiveSkill(lessonQuestions[questionIndex + 1].skill || activeSkill);
    setSelected("");
    setMatches({});
    setSelectedWord("");
    setAnswered(false);
    answerLock.current = false;
    setSpeechIssue(false);
    setCharacterState("learning");
  }

  function playAudio(text) {
    if (!("speechSynthesis" in window)) {
      setSpeechIssue(true);
      return;
    }
    setSpeechIssue(false);
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.onerror = () => setSpeechIssue(true);
    window.speechSynthesis.speak(utterance);
  }

  function resetProgress() {
    setProgress(emptyProgress);
    setLearningLevel("beginner");
    setShowResetConfirm(false);
    setSession([]);
    setSessionXp(0);
    setPage("home");
  }

  function saveName(event) {
    event.preventDefault();
    const nextName = nameDraft.trim();
    if (!nextName) return;
    setName(nextName);
    setNameDraft(nextName);
    setNameSaved(true);
    window.clearTimeout(nameSavedTimer.current);
    nameSavedTimer.current = window.setTimeout(() => setNameSaved(false), 2200);
  }

  function toggleSavedWord(word) {
    setSavedWords((items) => items.includes(word) ? items.filter((item) => item !== word) : [...items, word]);
  }

  function toggleLearnedWord(word) {
    setLearnedWords((items) => items.includes(word) ? items.filter((item) => item !== word) : [...items, word]);
  }

  function goTo(nextPage) {
    if (page === "lesson" && nextPage !== "lesson") {
      setPendingPage(nextPage);
      setShowLeaveConfirm(true);
      return;
    }
    setPage(nextPage);
    if (nextPage !== "lesson") setSpeechIssue(false);
    if (nextPage === "home") setCharacterState("idle");
  }

  function confirmLeaveLesson() {
    setShowLeaveConfirm(false);
    answerLock.current = false;
    transitionLock.current = false;
    setPendingPage("");
    setPage(pendingPage || "learn");
    setSpeechIssue(false);
  }

  function renderSkillCard(skillId, compact = false) {
    const skillData = lessons.find((item) => item.id === skillId);
    const label = t[`skill${skillId[0].toUpperCase()}${skillId.slice(1)}`];
    const description = t[`skill${skillId[0].toUpperCase()}${skillId.slice(1)}Text`];
    const skillStats = progress.skills[skillId];
    const skillAccuracy = skillStats?.answered
      ? Math.round((skillStats.correct / skillStats.answered) * 100)
      : 0;
    return (
      <button
        className={`skill-card skill-${skillId}${compact ? " skill-card-compact" : ""}`}
        key={skillId}
        onClick={() => startLesson(skillId)}
      >
        <span className="skill-icon" aria-hidden="true">{skillIcons[skillId]}</span>
        <span className="skill-card-copy">
          <strong>{label}</strong>
          <small>{compact ? `${skillStats?.answered || 0} ${t.questionsAnswered.toLowerCase()}` : description}</small>
          {compact && <span className="skill-mini-track"><span style={{ width: `${skillAccuracy}%` }} /></span>}
        </span>
        <span className="skill-arrow" aria-hidden="true">↗</span>
      </button>
    );
  }

  function renderHome() {
    const practicedSkills = skillKeys
      .filter((skillId) => progress.skills[skillId]?.answered)
      .sort((left, right) => (progress.skills[left].correct / progress.skills[left].answered) - (progress.skills[right].correct / progress.skills[right].answered));
    const recommendedSkill = practicedSkills[0] || "listening";
    const recommendedAccuracy = practicedSkills.length
      ? Math.round((progress.skills[recommendedSkill].correct / progress.skills[recommendedSkill].answered) * 100)
      : null;
    return (
      <div className="page-enter">
        <section className="hero-card">
          <div className="hero-copy">
            <span className="pill"><span className="status-dot" /> {t.adventure}</span>
            <h1>{t.greeting.replace("{name}", name)}</h1>
            <p>{t.welcomeText}</p>
            <button className="primary-button" onClick={() => startLesson("vocabulary")}>
              {progress.lessons ? t.continueLearning : t.startLearning}<span aria-hidden="true">→</span>
            </button>
            <div className="hero-note">✦ {t.pingiHint}</div>
          </div>
          <div className="hero-art">
            <div className="hero-orbit orbit-one" />
            <div className="hero-orbit orbit-two" />
            <span className="float-star star-one">✦</span>
            <span className="float-star star-two">✧</span>
            <span className="hero-sparkle sparkle-three">✧</span>
            <div className="hero-penguin"><Penguin state={dailyXp >= dailyGoal ? "dancing" : characterState} label={t.penguinDescription} /></div>
            <div className="speech-bubble">{t.pingiWelcome}<span>♥</span></div>
            <div className="ice-platform" />
          </div>
          <div className="hero-decoration">{t.heroTagline}</div>
        </section>

        <section className="review-card">
          <div className="review-pingi"><Penguin small state={missedCount ? "thinking" : "happy"} label={t.penguinDescription} /></div>
          <div><span className="eyebrow">{t.reviewMistakes}</span><h2>{missedCount ? `${missedCount} · ${t.reviewDescription}` : t.noMistakes}</h2></div>
          <button className="secondary-button" disabled={!missedCount} onClick={() => startLesson("review", true)}>{t.reviewNow}<span aria-hidden="true"> →</span></button>
        </section>

        <section className="stats-grid" aria-label={t.progressTitle}>
          <StatCard icon="✦" label={t.xp} value={progress.xp} detail="XP" tone="lilac" />
          <StatCard icon="🔥" label={t.streak} value={progress.streak} detail={t.days} tone="peach" />
          <StatCard icon="◉" label={t.lessonsDone} value={progress.lessons} detail={`${t.level} ${level}`} tone="blue" />
        </section>

        <section className="dashboard-row">
          <article className="goal-card">
            <div className="section-title-row">
              <span className="eyebrow">{t.dailyMission}</span>
              <span className="goal-icon">✦</span>
            </div>
            <h2>{dailyXp >= dailyGoal ? t.missionComplete : t.missionTitle.replace("{goal}", String(dailyGoal))}</h2>
            <p>{t.missionText}</p>
            <div className="goal-track" role="progressbar" aria-valuenow={Math.min(dailyXp, dailyGoal)} aria-valuemin="0" aria-valuemax={dailyGoal}>
              <span style={{ width: `${goalPercent}%` }} />
            </div>
            <div className="goal-count"><strong>{Math.min(dailyXp, dailyGoal)} / {dailyGoal} XP</strong><span>{goalPercent}%</span></div>
          </article>
          <article className="level-card">
            <div className="level-top">
              <span className="level-medal">✦</span>
              <div><small>{t.level}</small><strong>{level}</strong></div>
              <span className="level-xp">{levelProgress} / 100 XP</span>
            </div>
            <div className="level-track"><span style={{ width: `${levelProgress}%` }} /></div>
            <p>{100 - levelProgress} {t.toNextLevel}</p>
          </article>
        </section>

        <section className="section-heading">
          <div><span className="eyebrow">{t.choosePath}</span><h2>{t.exploreSkills}</h2></div>
          <button className="text-button" onClick={() => goTo("learn")}>{t.viewAll}<span aria-hidden="true">→</span></button>
        </section>
        <section className="skill-grid skill-grid-home">
          {skillKeys.map((skillId) => renderSkillCard(skillId))}
        </section>

        <section className="bottom-grid">
          <article className="recommend-card">
            <div className="recommend-icon">♫</div>
            <span className="eyebrow">{t.recommended}</span>
            <h2>{practicedSkills.length ? t[`skill${recommendedSkill[0].toUpperCase()}${recommendedSkill.slice(1)}`] : t.recommendedTitle}</h2>
            <p>{practicedSkills.length ? `${t[`skill${recommendedSkill[0].toUpperCase()}${recommendedSkill.slice(1)}Text`]} · ${recommendedAccuracy}%` : t.recommendedText}</p>
            <button className="text-button" onClick={() => startLesson(recommendedSkill)}>{t.startPractice}<span aria-hidden="true">→</span></button>
          </article>
          <article className="badges-card">
            <div className="section-title-row">
              <div><span className="eyebrow">{t.recentAchievements}</span><h2>{t.achievementsTitle}</h2></div>
              <button className="text-button" onClick={() => goTo("achievements")}>{t.seeAchievements}</button>
            </div>
            {activeBadges.length ? (
              <div className="badge-row">
                {activeBadges.slice(0, 3).map((badge) => (
                  <div className="mini-badge" key={badge.id} title={t[`${badge.id}Text`]}>
                    <span>{badge.icon}</span><small>{t[badge.id]}</small>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-badges"><span>✧</span><p>{t.noAchievements}</p></div>
            )}
          </article>
        </section>
      </div>
    );
  }

  function renderLearn() {
    const pathTopics = [...new Map(questionBank.map((question) => [`${question.level}:${question.topic}`, question])).values()];
    const groupedLevels = levels.map((levelId) => ({
      id: levelId,
      topics: pathTopics.filter((question) => question.level === levelId),
      unlocked: progress.xp >= levelUnlockXp[levelId],
    }));
    return (
      <section className="content-page page-enter">
        <div className="page-heading">
          <span className="eyebrow">{t.choosePath}</span>
          <h1>{t.exploreSkills}</h1>
          <p>{t.learnSubtitle}</p>
        </div>
        <div className="learn-banner">
          <div className="learn-banner-copy"><strong>{t.recommendedTitle}</strong><p>{t.recommendedText}</p></div>
          <Penguin small state="happy" label={t.penguinDescription} />
          <button className="primary-button" onClick={() => startLesson("vocabulary")}>{t.startLearning}<span aria-hidden="true">→</span></button>
        </div>
        <div className="learning-path-heading"><div><span className="eyebrow">{t.learningLevel}</span><h2>{t.exploreSkills}</h2></div><span className="path-xp">{progress.xp} XP</span></div>
        <div className="learning-path-list">
          {groupedLevels.map((stage, stageIndex) => (
            <section className={`learning-stage${stage.unlocked ? " learning-stage-open" : " learning-stage-locked"}`} key={stage.id}>
              <div className="learning-stage-marker"><span>{stage.unlocked ? "✓" : "🔒"}</span>{stageIndex < groupedLevels.length - 1 && <i />}</div>
              <div className="learning-stage-content"><div className="learning-stage-heading"><div><span className="eyebrow">{t.level} {stageIndex + 1}</span><h3>{t[`level${stage.id[0].toUpperCase()}${stage.id.slice(1)}`]}</h3></div><span>{stage.unlocked ? stage.topics.length : `${levelUnlockXp[stage.id]} XP`}</span></div>
                <div className="learning-topic-grid">{stage.topics.length ? stage.topics.map((entry) => {
                  const questionCount = questionBank.filter((question) => question.level === stage.id && question.topic === entry.topic).length;
                  const skillName = t[`skill${entry.skill[0].toUpperCase()}${entry.skill.slice(1)}`] || t.vocabulary;
                  const completed = (progress.completedTopics || []).includes(entry.topic);
                  return <button type="button" className={`learning-topic-card${completed ? " learning-topic-complete" : ""}`} key={`${stage.id}-${entry.topic}`} disabled={!stage.unlocked} onClick={() => startLesson(entry.skill, false, entry.topic, stage.id)}><span className="learning-topic-icon">{skillIcons[entry.skill] || "✦"}</span><span><strong>{t.topics[entry.topic] || entry.topic}</strong><small>{skillName} · {questionCount}</small></span><span className="learning-topic-arrow">{completed ? "✓" : "→"}</span></button>;
                }) : <p className="learning-stage-empty">{t.learnSubtitle}</p>}</div>
              </div>
            </section>
          ))}
        </div>
        <div className="skill-grid skill-grid-all">{skillKeys.map((skillId) => renderSkillCard(skillId))}</div>
      </section>
    );
  }

  function renderVocabulary() {
    return <VocabularyPage language={language} t={t} savedWords={savedWords} learnedWords={learnedWords} onSave={toggleSavedWord} onLearn={toggleLearnedWord} onSpeak={playAudio} />;
  }

  function renderProgress() {
    const locale = languageTags[language];
    const week = getWeekActivity(progress.activity, locale);
    const weekTotal = week.reduce((total, day) => total + day.xp, 0);
    const maxDayXp = Math.max(30, ...week.map((day) => day.xp));

    return (
      <section className="content-page page-enter">
        <div className="page-heading"><span className="eyebrow">{t.progress}</span><h1>{t.progressTitle}</h1><p>{t.progressIntro}</p></div>
        <div className="stats-grid progress-stat-grid">
          <StatCard icon="✦" label={t.xp} value={progress.xp} detail="XP" tone="lilac" />
          <StatCard icon="◎" label={t.accuracy} value={`${accuracy}%`} detail={`${progress.totalCorrect} / ${progress.totalAnswered}`} tone="blue" />
          <StatCard icon="✓" label={t.lessonsDone} value={progress.lessons} detail={t.totalLessons} tone="mint" />
          <StatCard icon="🔥" label={t.streak} value={progress.streak} detail={t.activeDays} tone="peach" />
        </div>
        <article className="chart-card">
          <div className="section-title-row"><div><span className="eyebrow">{t.thisWeek}</span><h2>{t.weeklyXp}</h2></div><strong className="chart-total">{weekTotal} XP</strong></div>
          <div className="week-chart" role="img" aria-label={`${t.weeklyXp}: ${weekTotal} XP`}>
            {week.map((day) => (
              <div className={`week-column${day.isToday ? " week-column-today" : ""}`} key={day.key}>
                <span className="week-xp">{day.xp || ""}</span>
                <div className="week-bar-track"><span style={{ height: `${day.xp ? Math.max(12, (day.xp / maxDayXp) * 100) : 5}%` }} /></div>
                <small>{day.label}</small>
              </div>
            ))}
          </div>
        </article>
        <article className="skill-progress-card">
          <div className="section-title-row"><div><span className="eyebrow">{t.skill}</span><h2>{t.skillProgress}</h2></div></div>
          <div className="skill-progress-list">
            {skillKeys.map((skillId) => {
              const stats = progress.skills[skillId] || { answered: 0, correct: 0 };
              const rate = stats.answered ? Math.round((stats.correct / stats.answered) * 100) : 0;
              return (
                <div className="skill-progress-row" key={skillId}>
                  <span className={`progress-skill-icon skill-icon-${skillId}`}>{skillIcons[skillId]}</span>
                  <strong>{t[`skill${skillId[0].toUpperCase()}${skillId.slice(1)}`]}</strong>
                  <span className="skill-progress-track"><span style={{ width: `${rate}%` }} /></span>
                  <small>{stats.answered ? `${rate}%` : "—"}</small>
                  <button onClick={() => startLesson(skillId)}>{t.practiceAgain}<span aria-hidden="true"> →</span></button>
                </div>
              );
            })}
          </div>
          {progress.totalAnswered === 0 && <p className="empty-message">{t.noPractice}</p>}
        </article>
      </section>
    );
  }

  function renderAchievements() {
    const badges = getAchievements(progress);
    return (
      <section className="content-page page-enter">
        <div className="page-heading"><span className="eyebrow">{t.achievements}</span><h1>{t.achievementsTitle}</h1><p>{t.achievementsText}</p></div>
        <div className="achievement-summary"><span>🏆</span><strong>{activeBadges.length} / {badges.length}</strong><small>{t.unlocked}</small></div>
        <div className="achievement-grid">
          {badges.map((badge) => (
            <article className={`achievement-card${badge.unlocked ? " achievement-unlocked" : ""}`} key={badge.id}>
              <div className="achievement-icon">{badge.icon}</div>
              <div><h2>{t[badge.id]}</h2><p>{t[`${badge.id}Text`]}</p></div>
              <span className="achievement-status">{badge.unlocked ? t.unlocked : t.locked}</span>
            </article>
          ))}
        </div>
      </section>
    );
  }

  function renderProfile() {
    const joinedDate = new Date().toLocaleDateString(languageTags[language], { month: "long", year: "numeric" });
    const badges = getAchievements(progress);
    const week = getWeekActivity(progress.activity, languageTags[language]);
    const weekTotal = week.reduce((total, day) => total + day.xp, 0);
    const maxDayXp = Math.max(30, ...week.map((day) => day.xp));
    return (
      <section className="content-page page-enter">
        <div className="page-heading"><span className="eyebrow">{t.profile}</span><h1>{t.profileTitle}</h1><p>{t.profileText}</p></div>
        <article className="profile-card">
          <div className="profile-top">
            <div className="profile-avatar" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</div>
            <div><span className="eyebrow">{t.level} {level}</span><h2>{name}</h2><p>{t.memberSince} · {joinedDate}</p></div>
            <div className="profile-xp"><span>✦</span><strong>{progress.xp}</strong><small>XP</small></div>
          </div>
          <div className="profile-level-track"><span style={{ width: `${levelProgress}%` }} /></div>
          <div className="profile-level-label"><span>{t.level} {level}</span><span>{100 - levelProgress} {t.toNextLevel}</span><span>{t.level} {level + 1}</span></div>
        </article>
        <form className="name-form" onSubmit={saveName}>
          <label htmlFor="learner-name">{t.learnerName}</label>
          <div><input id="learner-name" value={nameDraft} maxLength={24} onChange={(event) => setNameDraft(event.target.value)} /><button className="primary-button" type="submit" disabled={!nameDraft.trim()}>{t.saveName}</button></div>
          {nameSaved && <p className="saved-message" role="status">{t.nameSaved}</p>}
        </form>
        <div className="profile-stat-grid">
          <StatCard icon="🔥" label={t.streak} value={progress.streak} detail={t.activeDays} tone="peach" />
          <StatCard icon="✓" label={t.totalLessons} value={progress.lessons} detail={t.lessonsDone} tone="mint" />
          <StatCard icon="◉" label={t.accuracy} value={`${accuracy}%`} detail={`${progress.totalAnswered} ${t.totalQuestions.toLowerCase()}`} tone="blue" />
        </div>
        <article className="chart-card profile-week-card">
          <div className="section-title-row"><div><span className="eyebrow">{t.thisWeek}</span><h2>{t.weeklyXp}</h2></div><strong className="chart-total">{weekTotal} XP</strong></div>
          <div className="week-chart" role="img" aria-label={`${t.weeklyXp}: ${weekTotal} XP`}>
            {week.map((day) => (
              <div className={`week-column${day.isToday ? " week-column-today" : ""}`} key={day.key}>
                <span className="week-xp">{day.xp || ""}</span><div className="week-bar-track"><span style={{ height: `${day.xp ? Math.max(12, (day.xp / maxDayXp) * 100) : 5}%` }} /></div><small>{day.label}</small>
              </div>
            ))}
          </div>
        </article>
        <article className="profile-badges">
          <div className="section-title-row"><div><span className="eyebrow">{t.achievements}</span><h2>{t.recentAchievements}</h2></div><button className="text-button" onClick={() => goTo("achievements")}>{t.seeAchievements}<span> →</span></button></div>
          <div className="badge-row">
            {badges.map((badge) => <div className={`mini-badge${badge.unlocked ? "" : " badge-locked"}`} key={badge.id} title={t[badge.id]}><span>{badge.icon}</span><small>{t[badge.id]}</small></div>)}
          </div>
        </article>
      </section>
    );
  }

  function renderSettings() {
    const nextUnlock = levels.find((levelName) => progress.xp < levelUnlockXp[levelName]);
    const unlockXp = nextUnlock ? levelUnlockXp[nextUnlock] : progress.xp;
    return (
      <section className="content-page page-enter settings-page">
        <div className="page-heading"><span className="eyebrow">{t.settings}</span><h1>{t.settingsTitle}</h1><p>{t.settingsText}</p></div>
        <article className="settings-card">
          <label className="setting-row" htmlFor="interface-language"><span><strong>{t.interfaceLanguage}</strong><small>{t.savedLocally}</small></span>
            <select id="interface-language" value={language} onChange={(event) => setLanguage(event.target.value)}>
              {Object.keys(languages).map((languageName) => <option key={languageName} value={languageName}>{languageName}</option>)}
            </select>
          </label>
          <div className="setting-row"><span><strong>{t.learningLanguage}</strong><small>{t.englishLearning}</small></span><span className="fixed-language">🇬🇧 English</span></div>
          <label className="setting-row" htmlFor="daily-goal"><span><strong>{t.goalSettings}</strong><small>{t.goalHint}</small></span>
            <select id="daily-goal" value={dailyGoal} onChange={(event) => setDailyGoal(Number(event.target.value))}>
              {[20, 30, 50].map((goal) => <option key={goal} value={goal}>{goal} XP</option>)}
            </select>
          </label>
          <label className="setting-row" htmlFor="learning-level"><span><strong>{t.learningLevel}</strong><small>{nextUnlock ? t.stageUnlockHint.replace("{xp}", String(unlockXp)) : t.maxLevelReached}</small></span>
            <select id="learning-level" value={learningLevel} onChange={(event) => setLearningLevel(event.target.value)}>
              {levels.map((levelName) => {
                const unlocked = progress.xp >= levelUnlockXp[levelName];
                return <option key={levelName} value={levelName} disabled={!unlocked}>{t[`level${levelName[0].toUpperCase()}${levelName.slice(1)}`]}{unlocked ? "" : ` · ${levelUnlockXp[levelName]} XP`}</option>;
              })}
            </select>
          </label>
          <div className="setting-row sound-setting">
            <span><strong>{t.soundEffects}</strong><small>{t.soundDescription}</small></span>
            <button className={`sound-toggle${soundsEnabled ? " sound-toggle-on" : ""}`} role="switch" aria-checked={soundsEnabled} aria-label={t.soundEffects} onClick={() => setSoundsEnabled((enabled) => !enabled)}>
              <span />{soundsEnabled ? t.soundOn : t.soundOff}
            </button>
          </div>
          <div className="setting-row sound-setting">
            <span><strong>{t.animationEffects}</strong><small>{t.animationDescription}</small></span>
            <button className={`sound-toggle${animationsEnabled ? " sound-toggle-on" : ""}`} role="switch" aria-checked={animationsEnabled} aria-label={t.animationEffects} onClick={() => setAnimationsEnabled((enabled) => !enabled)}>
              <span />{animationsEnabled ? t.soundOn : t.soundOff}
            </button>
          </div>
        </article>
        <article className="storage-card"><span className="storage-icon">✓</span><div><strong>{storageError ? t.storageError : t.savedLocally}</strong><p>{storageError ? t.storageError : t.goalHint}</p></div></article>
        <article className="reset-card"><div><h2>{t.resetProgress}</h2><p>{t.resetDescription}</p></div><button className="danger-button" onClick={() => setShowResetConfirm(true)}>{t.reset}</button></article>
      </section>
    );
  }

  function addWord(word) {
    setSelected((current) => [...(Array.isArray(current) ? current : []), word]);
  }

  function correctAnswerText(question) {
    if (question.type === "match") return question.pairs.map((pair) => `${pair.word} — ${pair.meaning}`).join(", ");
    if (question.type === "translateToInterface") return question.answerByLanguage[language];
    if (question.type === "trueFalse") return question.answer === "true" ? t.true : t.false;
    return question.correction || question.answer;
  }

  function renderLesson() {
    const question = currentQuestion;
    if (!question) return null;
    const answeredProgress = ((questionIndex + (answered ? 1 : 0)) / lessonQuestions.length) * 100;
    const hasAnswer = question.type === "match"
      ? Object.keys(matches).length === question.pairs.length
      : Array.isArray(selected)
        ? selected.length > 0
        : Boolean(selected.trim());
    const categoryName = t[`skill${visibleSkill[0].toUpperCase()}${visibleSkill.slice(1)}`];
    const options = getOptions(question, language, t);
    const typeLabel = t.exerciseTypes[question.type] || t.exercise;
    const questionPrompt = question.promptByLanguage?.[language] || question.prompt;
    const translationSource = question.type === "translateToEnglish" ? question.sourceByLanguage[language] : question.sourceText;
    const isChoiceType = [
      "choice", "translate", "translateToInterface", "translateToEnglish", "listening", "reading",
      "pronunciation", "grammarMistake", "verbForm", "conversation", "dialogue", "pictureMatch",
      "pictureWord", "trueFalse", "synonym", "opposite",
    ].includes(question.type);
    const characterMood = answered
      ? ["encouraging", "dancing", "excited"].includes(characterState)
        ? characterState
        : session[session.length - 1]?.correct ? "happy" : "sad"
      : characterState;

    return (
      <section className="lesson-layout page-enter">
        <div className="lesson-top">
          <button className="back-button" onClick={() => goTo("learn")}><span aria-hidden="true">←</span> {t.learn}</button>
          <span className={`lesson-topic skill-topic-${visibleSkill}`}>{categoryName}</span>
          <span className="lesson-xp">✦ {sessionXp} XP</span>
        </div>
        <div className="lesson-progress-label"><span>{t.question} {questionIndex + 1} {t.of} {lessonQuestions.length}</span><span>{Math.round(answeredProgress)}%</span></div>
        <div className="lesson-progress"><span style={{ width: `${answeredProgress}%` }} /></div>
        <article className={`exercise-card exercise-${question.type}`} key={question.id}>
          <div className={`exercise-pingi exercise-mood-${characterMood}`}><Penguin small state={characterMood} label={t.penguinDescription} /></div>
          <div className="exercise-bubble"><strong>{t.pingi}</strong><p>{answered ? (session[session.length - 1]?.correct ? t.pingiCelebrate : t.tryAgain) : t.pingiHint}</p></div>
          <span className="exercise-count">{String(questionIndex + 1).padStart(2, "0")} / {String(lessonQuestions.length).padStart(2, "0")}</span>
          <div className="exercise-label-row">
            <span className={`exercise-label exercise-label-${question.type}`}>{typeLabel}</span>
            <span className="question-topic">{t.topics[question.topic] || t.topics[visibleSkill]}</span>
            <span className="question-level">{t[`level${question.level[0].toUpperCase()}${question.level.slice(1)}`]}</span>
            {reviewOnly && <span className="review-label">{t.reviewMistakes}</span>}
          </div>
          {question.audioText && (
            <div className="audio-panel">
              <div><span className="audio-wave" aria-hidden="true">♫</span><span>{visibleSkill === "pronunciation" ? t.speakPrompt : t.listen}</span></div>
              <button onClick={() => playAudio(question.audioText)} aria-label={t.playAudio}>▶ <span>{t.playAudio}</span></button>
              {speechIssue && <p role="status">{t.audioUnavailable}</p>}
            </div>
          )}
          {question.passage && <div className="reading-passage"><span className="eyebrow">{t.readingPassage}</span><p>{question.passage}</p></div>}
          {question.dialogue && <div className="dialogue-card"><span className="eyebrow">{t.dialogueLabel}</span>{question.dialogue.map((line) => <p key={line}>{line}</p>)}</div>}
          {question.statement && <div className="statement-card"><span className="eyebrow">{t.statementLabel}</span><strong>{question.statement}</strong></div>}
          {question.picture && <div className={`picture-stage${question.type === "pictureWord" ? " picture-stage-large" : ""}`}><span className="eyebrow">{question.type === "pictureWord" ? t.pictureWordLabel : t.pictureLabel}</span><span className="picture-illustration" aria-hidden="true">{question.picture}</span></div>}
          <h1>{questionPrompt}</h1>
          {translationSource && (
            <div className="translation-card">
              <span>{question.type === "translateToEnglish" ? t.sourcePrompt : t.englishPrompt}</span>
              <strong>{translationSource}</strong>
            </div>
          )}
          {question.hint && <p className="question-hint">✦ {question.hint}</p>}
          {isChoiceType && (
            <div className={`answer-list${question.type === "pictureWord" ? " picture-answer-list" : ""}${question.type === "trueFalse" ? " true-false-list" : ""}`}>
              {options.map((option, index) => {
                let className = "answer-option";
                if (question.type === "pictureWord") className += " picture-answer";
                if (question.type === "trueFalse") className += option.value === "true" ? " true-option" : " false-option";
                if (selected === option.value) className += " selected";
                if (answered && option.value === (question.type === "translateToInterface" ? question.answerByLanguage[language] : question.answer)) className += " answer-correct";
                if (answered && selected === option.value && option.value !== (question.type === "translateToInterface" ? question.answerByLanguage[language] : question.answer)) className += " answer-wrong";
                return (
                  <button key={option.value} className={className} onClick={() => !answered && setSelected(option.value)} disabled={answered} aria-pressed={selected === option.value}>
                    {question.type !== "trueFalse" && <span className="option-letter">{String.fromCharCode(65 + index)}</span>}<span>{option.label}</span>
                    {answered && option.value === (question.type === "translateToInterface" ? question.answerByLanguage[language] : question.answer) && <b>✓</b>}
                    {answered && selected === option.value && option.value !== (question.type === "translateToInterface" ? question.answerByLanguage[language] : question.answer) && <b>×</b>}
                  </button>
                );
              })}
            </div>
          )}
          {(question.type === "fill" || question.type === "writing") && (
            <label className="answer-input-wrap">
              <span>{t.typeAnswer}</span>
              <input
                type="text"
                value={selected}
                onChange={(event) => setSelected(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter" && !answered) submitAnswer(); }}
                disabled={answered}
                autoComplete="off"
                autoCapitalize="sentences"
              />
            </label>
          )}
          {(question.type === "arrange" || question.type === "buildSentence") && (
            <div className={`arrange-area${question.type === "buildSentence" ? " build-sentence-area" : ""}`}>
              <p>{question.type === "buildSentence" ? t.buildSentenceHint : t.wordBank}</p>
              <div className="sentence-build" aria-label={t.yourSentence}>
                {Array.isArray(selected) && selected.length ? selected.map((word, index) => <button key={`${word}-${index}`} disabled={answered} onClick={() => setSelected((items) => items.filter((_, itemIndex) => itemIndex !== index))}>{word} <span aria-hidden="true">×</span></button>) : <span>{t.yourSentence}</span>}
                {selected.length > 0 && !answered && <button className="clear-words" onClick={() => setSelected([])}>{t.clear}</button>}
              </div>
              <div className="word-bank" aria-label={t.wordBank}>
                {[...question.wordBank, ...(question.optionalWords || [])].map((word, index) => {
                  const used = (Array.isArray(selected) ? selected : []).filter((item) => item === word).length;
                  const available = (question.wordBank.includes(word) ? 1 : 0) + (question.optionalWords?.includes(word) ? 1 : 0);
                  return <button key={`${word}-${index}`} disabled={answered || used >= available} onClick={() => addWord(word)}>{word}</button>;
                })}
              </div>
            </div>
          )}
          {question.type === "match" && (
            <div className="matching-area">
              <p>{t.matchingHint}</p>
              <div className="matching-columns">
                <div><span>{t.chooseWord}</span>{question.pairs.map((pair) => <button key={pair.word} className={selectedWord === pair.word ? "match-option match-selected" : matches[pair.word] ? "match-option match-done" : "match-option"} disabled={answered || Boolean(matches[pair.word])} onClick={() => setSelectedWord(pair.word)}>{matches[pair.word] ? `✓ ${pair.word}` : pair.word}</button>)}</div>
                <div><span>{t.chooseMeaning}</span>{[...question.pairs].reverse().map((pair) => {
                  const used = Object.values(matches).includes(pair.meaning);
                  return <button key={pair.meaning} className="match-option" disabled={answered || !selectedWord || used} onClick={() => { setMatches((old) => ({ ...old, [selectedWord]: pair.meaning })); setSelectedWord(""); }}>{used ? `✓ ${pair.meaning}` : pair.meaning}</button>;
                })}</div>
              </div>
              {Object.keys(matches).length > 0 && <button className="clear-match" disabled={answered} onClick={() => { setMatches({}); setSelectedWord(""); }}>{t.clear}</button>}
            </div>
          )}
          {question.type === "categorize" && (
            <div className="categorize-card">
              <span className="eyebrow">{t.classifyLabel}</span>
              <strong className="categorize-word">{question.item}</strong>
              <div className="category-options">
                {options.map((option) => (
                  <button key={option.value} className={`category-chip${selected === option.value ? " category-selected" : ""}${answered && option.value === question.answer ? " category-correct" : ""}${answered && selected === option.value && option.value !== question.answer ? " category-wrong" : ""}`} disabled={answered} onClick={() => setSelected(option.value)}>{option.label}</button>
                ))}
              </div>
            </div>
          )}
          {answered && (
            <div className={`feedback ${session[session.length - 1]?.correct ? "feedback-correct" : "feedback-wrong"}`} role="status">
              <strong>{session[session.length - 1]?.correct ? `✓ ${t.correct}` : `↻ ${t.incorrect}`}</strong>
              {!session[session.length - 1]?.correct && <p><b>{t.correctAnswer} </b>{correctAnswerText(question)}</p>}
              <p>{question.explanation}</p>
              {session[session.length - 1]?.correct && <span className="feedback-xp">+10 XP</span>}
            </div>
          )}
          {newAchievement && <div className="achievement-pop" role="status"><span>🏆</span><strong>{newAchievement}</strong><button onClick={() => setNewAchievement("")} aria-label={t.dismiss}>×</button></div>}
          {!answered
            ? <button className="primary-button submit-button" disabled={!hasAnswer} onClick={submitAnswer}>{t.checkAnswer}<span aria-hidden="true">→</span></button>
            : <button className="primary-button submit-button" onClick={nextQuestion}>{questionIndex === lessonQuestions.length - 1 ? t.finishLesson : t.nextQuestion}<span aria-hidden="true">→</span></button>}
        </article>
      </section>
    );
  }

  function renderCompletion() {
    return (
      <section className="completion-card page-enter">
        <div className="confetti confetti-one">✦</div><div className="confetti confetti-two">✧</div><div className="confetti confetti-three">✦</div>
        <div className="completion-pengi"><Penguin state="dancing" label={t.penguinDescription} /></div>
        {newAchievement && <div className="achievement-pop completion-achievement" role="status"><span>🏆</span><strong>{newAchievement}</strong><button onClick={() => setNewAchievement("")} aria-label={t.dismiss}>×</button></div>}
        <span className="eyebrow">{t.allCaughtUp}</span><h1>{t.lessonComplete}</h1>
        <p>{t.yourScore}: <strong>{correctCount} / {session.length}</strong></p>
        <div className="completion-rewards"><span>✦ <strong>+{sessionXp}</strong> {t.xpEarned}</span><span>🎁 <strong>+10</strong> {t.bonus}</span></div>
        <div className="completion-actions">
          <button className="primary-button" onClick={() => startLesson(activeSkill)}>{t.tryAnother}<span aria-hidden="true">→</span></button>
          <button className="secondary-button" onClick={() => goTo("home")}>{t.backHome}</button>
        </div>
      </section>
    );
  }

  const navItems = [
    { id: "home", label: t.home, icon: "⌂" },
    { id: "learn", label: t.learn, icon: "✎" },
    { id: "vocabulary", label: t.vocabulary, icon: "✳" },
    { id: "progress", label: t.progress, icon: "▥" },
    { id: "achievements", label: t.achievements, icon: "☆" },
    { id: "profile", label: t.profile, icon: "◉" },
    { id: "settings", label: t.settings, icon: "⚙" },
  ];
  const activePage = page === "lesson" || page === "complete" ? "learn" : page;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => goTo("home")} aria-label={`${t.home} - PINGUI`}>
          <span className="brand-mark"><Penguin small label={t.penguinDescription} /></span><span>PINGUI<span className="brand-dot">.</span></span>
        </button>
        <div className="sidebar-label">{t.menu}</div>
        <nav className="navigation" aria-label={t.menu}>
          {navItems.map((item) => (
            <button key={item.id} className={`nav-item${activePage === item.id ? " active" : ""}`} onClick={() => goTo(item.id)} aria-current={activePage === item.id ? "page" : undefined}>
              <span aria-hidden="true">{item.icon}</span>{item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="mini-pingi"><Penguin small state="encouraging" label={t.penguinDescription} /></div>
          <strong>{t.pingi}</strong><p>{t.pingiHint}</p>
          <div className="sidebar-level"><span>{t.level} {level}</span><span>{progress.xp} XP</span></div>
          <div className="tiny-progress"><span style={{ width: `${levelProgress}%` }} /></div>
          <button className="sidebar-profile" onClick={() => goTo("profile")}>{name}<span aria-hidden="true">→</span></button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div><span className="eyebrow">{t.adventure}</span><p className="topbar-subtitle">{t.subtitle}</p></div>
          <div className="topbar-actions">
            <div className="topbar-streak"><span>🔥</span><strong>{progress.streak}</strong></div>
            <label className="language-select"><span aria-hidden="true">◎</span>
              <select value={language} onChange={(event) => setLanguage(event.target.value)} aria-label={t.interfaceLanguage}>
                {Object.keys(languages).map((languageName) => <option key={languageName} value={languageName}>{languageName}</option>)}
              </select>
            </label>
            <button className="topbar-avatar" onClick={() => goTo("profile")} aria-label={`${t.profile}: ${name}`}>{name.slice(0, 1).toUpperCase()}</button>
          </div>
        </header>
        {storageError && <div className="storage-warning" role="alert">{t.storageError}</div>}
        {page === "home" && renderHome()}
        {page === "learn" && renderLearn()}
        {page === "vocabulary" && renderVocabulary()}
        {page === "progress" && renderProgress()}
        {page === "achievements" && renderAchievements()}
        {page === "profile" && renderProfile()}
        {page === "settings" && renderSettings()}
        {page === "lesson" && renderLesson()}
        {page === "complete" && renderCompletion()}
        <footer className="footer"><span>© 2026 PINGUI</span><span>{t.footer} <b>♥</b></span></footer>
      </main>

      {showResetConfirm && (
        <div className="modal-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setShowResetConfirm(false); }}>
          <section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="reset-title">
            <span className="modal-icon">↻</span><h2 id="reset-title">{t.resetProgress}</h2><p>{t.confirmReset}</p>
            <div><button className="secondary-button" onClick={() => setShowResetConfirm(false)}>{t.cancel}</button><button className="danger-button" onClick={resetProgress}>{t.reset}</button></div>
          </section>
        </div>
      )}

      {showLeaveConfirm && (
        <div className="modal-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setShowLeaveConfirm(false); }}>
          <section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="leave-title">
            <span className="modal-icon">🐧</span><h2 id="leave-title">Leave this lesson?</h2>
            <p>Your answers in this unfinished lesson will not count as a completed lesson. Are you sure you want to leave?</p>
            <div><button className="secondary-button" onClick={() => setShowLeaveConfirm(false)}>Stay in lesson</button><button className="danger-button" onClick={confirmLeaveLesson}>Leave lesson</button></div>
          </section>
        </div>
      )}
    </div>
  );
}
