export const vocabulary = [
  { word: "cozy", meaning: "warm and comfortable", example: "This café feels cozy on a rainy day.", topic: "everydayLife" },
  { word: "brave", meaning: "not afraid to do something difficult", example: "It was brave of her to try something new.", topic: "animals" },
  { word: "tiny", meaning: "very small", example: "A tiny bird sat by the window.", topic: "animals" },
  { word: "polite", meaning: "kind and respectful", example: "It is polite to say thank you.", topic: "communication" },
  { word: "discover", meaning: "to find something for the first time", example: "We discovered a lovely little park.", topic: "everydayLife" },
  { word: "curious", meaning: "wanting to learn or know more", example: "The curious child asked a great question.", topic: "school" },
  { word: "platform", meaning: "the area where you wait for a train", example: "Our train leaves from platform four.", topic: "travel" },
  { word: "journey", meaning: "the act of travelling from one place to another", example: "The journey to the coast took two hours.", topic: "travel" },
  { word: "recipe", meaning: "instructions for preparing a dish", example: "I found a simple recipe for soup.", topic: "food" },
  { word: "delicious", meaning: "having a very pleasant taste", example: "The warm bread smells delicious.", topic: "food" },
  { word: "reliable", meaning: "able to be trusted or depended on", example: "Mira is a reliable teammate.", topic: "work" },
  { word: "schedule", meaning: "a plan that shows when things will happen", example: "I added the meeting to my schedule.", topic: "work" },
  { word: "device", meaning: "a piece of equipment made for a purpose", example: "This device helps me read at night.", topic: "technology" },
  { word: "privacy", meaning: "the state of keeping personal information private", example: "Use a strong password to protect your privacy.", topic: "technology" },
  { word: "neighbour", meaning: "a person who lives near you", example: "Our neighbour watered the plants.", topic: "everydayLife" },
  { word: "patient", meaning: "able to wait calmly", example: "Be patient while the page loads.", topic: "communication" },
  { word: "improve", meaning: "to become or make something better", example: "A little practice can improve your English.", topic: "school" },
  { word: "comfortable", meaning: "making you feel relaxed and at ease", example: "These shoes are comfortable for walking.", topic: "everydayLife" },
];

export const vocabularyTopics = ["all", ...new Set(vocabulary.map(({ topic }) => topic))];
