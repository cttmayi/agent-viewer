import React from 'react';
import WelcomeScreen from './WelcomeScreen.jsx';
import SessionView from './SessionView.jsx';

export default function MainArea({ selectedSession, onBack }) {
  if (!selectedSession) return <WelcomeScreen />;
  return <SessionView session={selectedSession} onBack={onBack} />;
}
