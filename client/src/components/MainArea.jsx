import React from 'react';
import WelcomeScreen from './WelcomeScreen.jsx';
import SessionView from './SessionView.jsx';

export default function MainArea({ selectedSession, onBack, searchMessageIds, searchQuery }) {
  if (!selectedSession) return <WelcomeScreen />;
  return <SessionView session={selectedSession} onBack={onBack} searchMessageIds={searchMessageIds} searchQuery={searchQuery} />;
}
