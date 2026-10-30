import React, { useMemo, useState } from "react";
import { vocabulary, vocabularyTopics } from "./vocabularyData.js";
import Penguin from "./Penguin.jsx";

const copy = {
  English: { search: "Search words", all: "All topics", saved: "Saved words", learned: "Learned", save: "Save word", unsave: "Remove saved word", markLearned: "Mark learned", review: "Review again", flash: "Flashcards", close: "Close cards", previous: "Previous", next: "Next", reveal: "Show meaning", hide: "Hide meaning", empty: "No words match your search.", collection: "Your collection", count: "words", progress: "learning progress", start: "Start a short practice" },
  Norwegian: { search: "Søk etter ord", all: "Alle temaer", saved: "Lagrede ord", learned: "Lært", save: "Lagre ord", unsave: "Fjern lagret ord", markLearned: "Marker som lært", review: "Øv igjen", flash: "Flashkort", close: "Lukk kort", previous: "Forrige", next: "Neste", reveal: "Vis betydning", hide: "Skjul betydning", empty: "Ingen ord passer til søket.", collection: "Samlingen din", count: "ord", progress: "læringsfremgang", start: "Start en kort økt" },
  Russian: { search: "Найти слова", all: "Все темы", saved: "Сохранённые слова", learned: "Выучено", save: "Сохранить слово", unsave: "Удалить из сохранённых", markLearned: "Отметить как выученное", review: "Повторить", flash: "Карточки", close: "Закрыть карточки", previous: "Назад", next: "Далее", reveal: "Показать значение", hide: "Скрыть значение", empty: "По вашему запросу ничего не найдено.", collection: "Ваша коллекция", count: "слов", progress: "прогресс обучения", start: "Начать короткую практику" },
  Ukrainian: { search: "Знайти слова", all: "Усі теми", saved: "Збережені слова", learned: "Вивчено", save: "Зберегти слово", unsave: "Вилучити зі збережених", markLearned: "Позначити як вивчене", review: "Повторити", flash: "Картки", close: "Закрити картки", previous: "Назад", next: "Далі", reveal: "Показати значення", hide: "Сховати значення", empty: "За вашим запитом нічого не знайдено.", collection: "Ваша колекція", count: "слів", progress: "прогрес навчання", start: "Почати коротку практику" },
};

export default function VocabularyPage({ language, t, savedWords, learnedWords, onSave, onLearn, onSpeak }) {
  const [search, setSearch] = useState("");
  const [topic, setTopic] = useState("all");
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [flashIndex, setFlashIndex] = useState(-1);
  const [revealed, setRevealed] = useState(false);
  const ui = copy[language] || copy.English;
  const filtered = useMemo(() => vocabulary.filter((item) => {
    const term = search.trim().toLocaleLowerCase();
    return (!term || `${item.word} ${item.meaning} ${item.example}`.toLocaleLowerCase().includes(term))
      && (topic === "all" || item.topic === topic)
      && (!showSavedOnly || savedWords.includes(item.word));
  }), [search, topic, showSavedOnly, savedWords]);
  const flashWords = showSavedOnly ? filtered : filtered.filter((item) => !learnedWords.includes(item.word));
  const currentFlash = flashWords[flashIndex];

  function startFlashcards() {
    if (!flashWords.length) return;
    setFlashIndex(0);
    setRevealed(false);
  }

  function moveFlash(step) {
    setFlashIndex((index) => (index + step + flashWords.length) % flashWords.length);
    setRevealed(false);
  }

  return (
    <section className="content-page page-enter vocabulary-page">
      <div className="page-heading">
        <span className="eyebrow">{t.skillVocabulary}</span>
        <h1>{t.vocabulary}</h1>
        <p>{t.skillVocabularyText}</p>
      </div>
      <div className="vocabulary-overview">
        <div className="vocabulary-mascot"><span className="vocabulary-orbit">✦</span><div className="vocabulary-penguin"><Penguin small state="happy" /></div><span className="vocabulary-book">📚</span></div>
        <div className="vocabulary-overview-copy"><span className="eyebrow">{ui.collection}</span><h2>{savedWords.length} {ui.count} · {learnedWords.length} {ui.learned.toLocaleLowerCase()}</h2><p>{ui.progress}</p></div>
        <button className="primary-button" type="button" onClick={startFlashcards} disabled={!flashWords.length}>{ui.flash}<span aria-hidden="true">→</span></button>
      </div>
      <div className="vocabulary-toolbar">
        <label className="vocabulary-search"><span aria-hidden="true">⌕</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={ui.search} aria-label={ui.search} /></label>
        <label className="vocabulary-topic"><span className="sr-only">{t.questionTopic}</span><select value={topic} onChange={(event) => setTopic(event.target.value)} aria-label={t.questionTopic}>
          {vocabularyTopics.map((item) => <option key={item} value={item}>{item === "all" ? ui.all : t.topics[item] || item}</option>)}
        </select></label>
        <button type="button" className={`collection-filter${showSavedOnly ? " collection-filter-active" : ""}`} onClick={() => setShowSavedOnly((value) => !value)} aria-pressed={showSavedOnly}>♡ {ui.saved} <b>{savedWords.length}</b></button>
      </div>
      {filtered.length ? <div className="word-grid vocabulary-word-grid">
        {filtered.map((item, index) => {
          const saved = savedWords.includes(item.word);
          const learned = learnedWords.includes(item.word);
          return <article className={`word-card vocabulary-word-card${learned ? " vocabulary-word-learned" : ""}`} key={item.word}>
            <div className="word-card-top"><span className={`word-number word-tone-${index % 3}`}>{String(index + 1).padStart(2, "0")}</span><button type="button" className={`word-save${saved ? " word-save-active" : ""}`} onClick={() => onSave(item.word)} aria-label={saved ? ui.unsave : ui.save} aria-pressed={saved}>{saved ? "♥" : "♡"}</button></div>
            <span className="vocabulary-topic-tag">{t.topics[item.topic] || item.topic}</span><h2>{item.word}</h2><p>{item.meaning}</p><blockquote>“{item.example}”</blockquote>
            <div className="vocabulary-card-actions"><button type="button" className="word-listen" onClick={() => onSpeak(item.word)}>♫ <span>{t.playAudio}</span></button><button type="button" className="word-learn-button" onClick={() => onLearn(item.word)}>{learned ? `✓ ${ui.learned}` : ui.markLearned}</button></div>
          </article>;
        })}
      </div> : <div className="vocabulary-empty"><Penguin small state="thinking" /><h2>{ui.empty}</h2><button type="button" className="text-button" onClick={() => { setSearch(""); setTopic("all"); }}>{ui.all}</button></div>}
      {currentFlash && <div className="modal-backdrop vocabulary-flash-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setFlashIndex(-1); }}>
        <section className="flashcard-dialog" role="dialog" aria-modal="true" aria-label={ui.flash}>
          <div className="flashcard-topline"><span>{flashIndex + 1} / {flashWords.length}</span><button type="button" onClick={() => setFlashIndex(-1)} aria-label={ui.close}>×</button></div>
          <button type="button" className={`flashcard${revealed ? " flashcard-revealed" : ""}`} onClick={() => setRevealed((value) => !value)}>
            <span className="eyebrow">{t.topics[currentFlash.topic] || currentFlash.topic}</span><strong>{revealed ? currentFlash.meaning : currentFlash.word}</strong><small>{revealed ? currentFlash.example : ui.reveal}</small>
          </button>
          <div className="flashcard-actions"><button type="button" className="secondary-button" onClick={() => moveFlash(-1)}>{ui.previous}</button><button type="button" className="secondary-button" onClick={() => onLearn(currentFlash.word)}>{learnedWords.includes(currentFlash.word) ? `✓ ${ui.learned}` : ui.learned}</button><button type="button" className="primary-button" onClick={() => moveFlash(1)}>{ui.next} →</button></div>
        </section>
      </div>}
    </section>
  );
}
