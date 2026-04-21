import { useState, useRef, useEffect } from 'react';
import { STATES } from '../lib/visionEngine';

export function useRecorderState() {
  const [mode, setMode] = useState('ランク');
  const [myDecks, setMyDecks] = useState([]);
  const [oppDecks, setOppDecks] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);

  // Slot Persistence (Lock)
  const [isMyDeckLocked, setIsMyDeckLocked] = useState(true);
  const [isOpponentDeckLocked, setIsOpponentDeckLocked] = useState(false);
  const [isTagsLocked, setIsTagsLocked] = useState(false);

  // Data Slots
  const [turn, setTurn] = useState('');
  const [result, setResult] = useState('');
  const [diff, setDiff] = useState('');
  const [ratingChange, setRatingChange] = useState('');
  const [turnScore, setTurnScore] = useState(null);
  const [resultScore, setResultScore] = useState(null);

  // Manual Locks
  const [isTurnLocked, setIsTurnLocked] = useState(false);
  const [isResultLocked, setIsResultLocked] = useState(false);
  const [isDiffLocked, setIsDiffLocked] = useState(false);

  const [currentState, setCurrentState] = useState(STATES.IDLE);
  const [detectedCards, setDetectedCards] = useState([]);
  const [currentCard, setCurrentCard] = useState({ name: '', archetype: '', confidence: 0, votes: 0 });
  
  const stateRef = useRef(currentState);
  useEffect(() => { stateRef.current = currentState; }, [currentState]);

  const gotoState = (ns) => {
    stateRef.current = ns;
    setCurrentState(ns);
  };

  const slotsRef = useRef({ 
    turn, result, diff, mode, isTurnLocked, isResultLocked, isDiffLocked, 
    myDecks, oppDecks, isMyDeckLocked, isOpponentDeckLocked 
  });
  
  useEffect(() => { 
    slotsRef.current = { 
      turn, result, diff, mode, isTurnLocked, isResultLocked, isDiffLocked, 
      myDecks, oppDecks, isMyDeckLocked, isOpponentDeckLocked 
    }; 
  }, [turn, result, diff, mode, isTurnLocked, isResultLocked, isDiffLocked, myDecks, oppDecks, isMyDeckLocked, isOpponentDeckLocked]);

  return {
    mode, setMode,
    myDecks, setMyDecks,
    oppDecks, setOppDecks,
    selectedTags, setSelectedTags,
    isMyDeckLocked, setIsMyDeckLocked,
    isOpponentDeckLocked, setIsOpponentDeckLocked,
    isTagsLocked, setIsTagsLocked,
    turn, setTurn,
    result, setResult,
    diff, setDiff,
    ratingChange, setRatingChange,
    turnScore, setTurnScore,
    resultScore, setResultScore,
    isTurnLocked, setIsTurnLocked,
    isResultLocked, setIsResultLocked,
    isDiffLocked, setIsDiffLocked,
    currentState, setCurrentState,
    gotoState,
    detectedCards, setDetectedCards,
    currentCard, setCurrentCard,
    stateRef,
    slotsRef
  };
}
