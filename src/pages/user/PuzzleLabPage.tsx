import React from 'react';
import { TechCorpLabSession } from './TechCorpLabSession';

/**
 * PuzzleLabPage
 * Reuses the original interactive lab implementation (TechCorpLabSession)
 * which connects to the /puzzle/ infrastructure (Docker container, Xterm terminal, 
 * session provisioning, and level check APIs).
 */
export const PuzzleLabPage: React.FC = () => {
  return <TechCorpLabSession />;
};

export default PuzzleLabPage;
