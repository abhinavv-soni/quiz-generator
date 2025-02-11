import React, { useState } from 'react';
import './App.css';
import html2pdf from 'html2pdf.js';
import OpenAI from 'openai';

// Removed predefined topics

function App() {
  const [apiKey, setApiKey] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [quiz, setQuiz] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const validateApiKey = (key) => {
    if (!key) {
      setError('Please enter your OpenAI API key');
      return false;
    }
    if (!key.startsWith('sk-')) {
      setError('Please enter a valid OpenAI API key that starts with "sk-"');
      return false;
    }
    return true;
  };

  const generateQuiz = async () => {
    if (!selectedTopic.trim()) {
      setError('Please enter a topic');
      return;
    }

    if (!validateApiKey(apiKey)) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true
      });

      const prompt = `Create a multiple choice quiz with 5 questions about "${selectedTopic.trim()}". 
      The questions should be appropriate for the topic's difficulty level and domain.
      
      Format the response as a JSON object with this structure:
      {
        "questions": [
          {
            "question": "question text",
            "options": ["option1", "option2", "option3", "option4"],
            "correctAnswer": 0,
            "explanation": "explanation why this answer is correct"
          }
        ]
      }
      
      Guidelines:
      1. Questions should be challenging but fair
      2. All options should be plausible
      3. Explanations should be clear and educational
      4. Adapt difficulty to the topic
      5. Use domain-appropriate terminology
      6. Ensure accuracy of information`;

      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are a helpful quiz generator." },
          { role: "user", content: prompt }
        ]
      });

      const quizData = JSON.parse(completion.choices[0].message.content);
      
      if (quizData && quizData.questions && Array.isArray(quizData.questions)) {
        setQuiz(quizData);
        setError(null);
        setCurrentQuestion(0);
        setAnswers([]);
        setShowResults(false);
      } else {
        throw new Error('Invalid quiz data format received from OpenAI');
      }
    } catch (error) {
      console.error('Error generating quiz:', error);
      
      const errorMessage = error.message.toLowerCase();
      if (errorMessage.includes('api key')) {
        setError('Invalid API key. Please check your API key and try again.');
      } else if (errorMessage.includes('rate limit')) {
        setError('OpenAI API rate limit exceeded. Please try again in a few minutes.');
      } else if (errorMessage.includes('model')) {
        setError('The selected OpenAI model is not available. Please check your API key permissions.');
      } else {
        setError('Error generating quiz. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswer = (answerIndex) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = answerIndex;
    setAnswers(newAnswers);

    if (currentQuestion < quiz.questions.length - 1) {
      setTimeout(() => {
        setCurrentQuestion(currentQuestion + 1);
      }, 300);
    } else {
      setTimeout(() => {
        setShowResults(true);
      }, 300);
    }
  };

  const exportQuiz = async (includeAnswers = true) => {
    const element = document.createElement('div');
    element.innerHTML = `
      <div style="font-family: 'Plus Jakarta Sans', sans-serif;">
        <h1 style="text-align: center; background: linear-gradient(135deg, #6366F1, #8B5CF6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size: 2.5rem; font-weight: 800; margin-bottom: 2rem;">
          Quiz Results - ${selectedTopic}
        </h1>
        ${quiz.questions.map((q, index) => `
          <div style="margin-bottom: 2rem; padding: 1.5rem; border-radius: 1rem; background: #FAFAFA; border: 1px solid #E5E7EB;">
            <h3 style="color: #1F2937; font-size: 1.25rem; font-weight: 600; margin-bottom: 1rem;">
              Question ${index + 1}:
            </h3>
            <p style="margin: 0.75rem 0; color: #374151; font-size: 1.125rem;">${q.question}</p>
            <div style="margin: 1rem 0;">
              ${q.options.map((option, optIndex) => `
                <div style="margin: 0.5rem 0; padding: 0.75rem 1rem; border-radius: 0.75rem; background: ${
                  includeAnswers && optIndex === q.correctAnswer ? '#F0FDF4' : '#FFFFFF'
                }; border: 1px solid ${
                  includeAnswers && optIndex === q.correctAnswer ? '#86EFAC' : '#E5E7EB'
                };">
                  <span style="display: inline-flex; align-items: center;">
                    <span style="width: 1.75rem; height: 1.75rem; display: inline-flex; align-items: center; justify-content: center; border-radius: 0.5rem; background: ${
                      includeAnswers && optIndex === q.correctAnswer ? '#22C55E' : '#6366F1'
                    }; color: white; font-weight: 600; margin-right: 0.75rem;">
                      ${String.fromCharCode(65 + optIndex)}
                    </span>
                    ${option}
                    ${includeAnswers && optIndex === q.correctAnswer ? 
                      '<span style="margin-left: 0.5rem; color: #22C55E;">✓</span>' : 
                      ''}
                  </span>
                </div>
              `).join('')}
            </div>
            ${includeAnswers ? `
              <div style="margin-top: 1rem; padding: 1rem; border-radius: 0.75rem; background: #ECFDF5; border: 1px solid #A7F3D0;">
                <p style="color: #047857; margin: 0;">
                  <strong>Explanation:</strong> ${q.explanation}
                </p>
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    `;

    const opt = {
      margin: 1,
      filename: includeAnswers ? 'quiz-with-answers.pdf' : 'quiz.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    try {
      await html2pdf().set(opt).from(element).save();
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Error exporting PDF. Please try again.');
    }
  };

  const resetQuiz = () => {
    setQuiz(null);
    setCurrentQuestion(0);
    setAnswers([]);
    setShowResults(false);
    setSelectedTopic('');
    setError(null);
  };

  const calculateScore = () => {
    return answers.reduce(
      (score, answer, index) =>
        answer === quiz.questions[index].correctAnswer ? score + 1 : score,
      0
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <div className="quiz-container animate-fade-in">
        <div className="text-center mb-16">
          <h1 className="text-6xl font-extrabold mb-6 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 bg-clip-text text-transparent">
            Quiz Generator
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Challenge yourself with AI-generated quizzes. Choose a topic and test your knowledge!
          </p>
        </div>

        {!quiz && (
          <div className="glass-card p-10 animate-scale-in">
            <div className="mb-8">
              <label className="block text-lg font-semibold text-gray-700 mb-2">
                OpenAI API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="input-field"
                placeholder="Enter your OpenAI API key (starts with sk-)"
              />
              <p className="mt-2 text-sm text-gray-500">
                Your API key is required to generate quizzes. It's only used in your browser and never stored.
              </p>
            </div>

            <div className="mb-10">
              <label className="block text-lg font-semibold text-gray-700 mb-2">
                Enter Quiz Topic
              </label>
              <input
                type="text"
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                className="input-field"
                placeholder="Enter any topic (e.g., JavaScript, Ancient Rome, Quantum Physics)"
              />
              <p className="mt-2 text-sm text-gray-500">
                Enter any topic you'd like to be quizzed on. Be specific for better results!
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl animate-shake">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-red-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-red-600 font-medium">{error}</p>
                </div>
              </div>
            )}

            <button
              onClick={generateQuiz}
              disabled={!selectedTopic || !apiKey || isLoading}
              className={`btn-primary w-full ${(!selectedTopic || !apiKey || isLoading) ? 'opacity-75 cursor-not-allowed' : ''}`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating Quiz...
                </span>
              ) : (
                'Generate Quiz'
              )}
            </button>
          </div>
        )}

        {quiz && !showResults && (
          <div className="glass-card p-10 animate-scale-in">
            <div className="mb-8">
              <div className="flex justify-between items-center mb-4">
                <span className="text-lg font-medium text-gray-700">
                  Question {currentQuestion + 1} of {quiz.questions.length}
                </span>
                <span className="text-lg font-medium text-indigo-600">
                  {Math.round(((currentQuestion + 1) / quiz.questions.length) * 100)}% Complete
                </span>
              </div>
              <div className="progress-bar-container">
                <div
                  className="progress-bar"
                  style={{ width: `${((currentQuestion + 1) / quiz.questions.length) * 100}%` }}
                />
              </div>
            </div>

            <div className="animate-fade-in">
              <h2 className="text-2xl font-bold text-gray-900 mb-8">
                {quiz.questions[currentQuestion].question}
              </h2>
              <div className="space-y-4">
                {quiz.questions[currentQuestion].options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => handleAnswer(index)}
                    className="quiz-option group w-full"
                  >
                    <span className="inline-flex items-center">
                      <span className="w-10 h-10 flex items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 font-semibold mr-4 group-hover:bg-indigo-200 transition-colors duration-200">
                        {String.fromCharCode(65 + index)}
                      </span>
                      <span className="text-lg">{option}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {showResults && (
          <div className="glass-card p-10 animate-scale-in">
            <h2 className="text-4xl font-bold text-center text-gray-900 mb-10">Quiz Complete! 🎉</h2>
            <div className="mb-10">
              <div className="result-card">
                <div className="text-center mb-6">
                  <p className="score-display mb-4">
                    {calculateScore()} / {quiz.questions.length}
                  </p>
                  <p className="text-2xl font-semibold text-gray-700">
                    {Math.round((calculateScore() / quiz.questions.length) * 100)}% Score
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-lg text-gray-600">
                    {calculateScore() === quiz.questions.length
                      ? "Perfect score! You're a master of this topic! 🏆"
                      : calculateScore() >= quiz.questions.length * 0.7
                      ? "Great job! You've shown excellent knowledge! 🌟"
                      : "Good effort! Keep learning and try again! 💪"}
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button
                onClick={() => exportQuiz(false)}
                className="btn-primary"
              >
                Export Quiz
              </button>
              <button
                onClick={() => exportQuiz(true)}
                className="btn-primary"
              >
                Export with Answers
              </button>
              <button
                onClick={resetQuiz}
                className="btn-secondary"
              >
                Try Another Quiz
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;