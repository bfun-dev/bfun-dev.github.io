import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface OnboardingState {
  hasCompletedTutorial: boolean;
  tutorialStep: number;
  totalPoints: number;
  unlockedBadges: string[];
  lastActiveDate: string | null;
}

const defaultOnboardingState: OnboardingState = {
  hasCompletedTutorial: false,
  tutorialStep: 0,
  totalPoints: 0,
  unlockedBadges: [],
  lastActiveDate: null,
};

export function useOnboarding(userId?: string) {
  const [onboardingState, setOnboardingState] = useState<OnboardingState>(defaultOnboardingState);
  const [showTutorial, setShowTutorial] = useState(false);
  const queryClient = useQueryClient();

  // Mutation to mark tutorial as seen
  const markTutorialSeenMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/user/tutorial-seen', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to mark tutorial as seen');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    },
  });

  // Load onboarding state from localStorage for the specific user
  useEffect(() => {
    if (userId) {
      const saved = localStorage.getItem(`onboarding-state-${userId}`);
      if (saved) {
        try {
          const parsedState = JSON.parse(saved);
          setOnboardingState(parsedState);
        } catch (error) {
          console.error('Failed to parse onboarding state:', error);
        }
      } else {
        // First time user - reset to default state
        setOnboardingState(defaultOnboardingState);
      }
    }
  }, [userId]);

  // Save onboarding state to localStorage for the specific user
  const saveOnboardingState = (newState: OnboardingState) => {
    if (userId) {
      setOnboardingState(newState);
      localStorage.setItem(`onboarding-state-${userId}`, JSON.stringify(newState));
    }
  };

  const startTutorial = () => {
    setShowTutorial(true);
  };

  const completeTutorial = (points: number) => {
    const newState: OnboardingState = {
      ...onboardingState,
      hasCompletedTutorial: true,
      totalPoints: onboardingState.totalPoints + points,
      lastActiveDate: new Date().toISOString(),
    };
    saveOnboardingState(newState);
    setShowTutorial(false);
    
    // Mark tutorial as seen in the database and localStorage
    if (userId) {
      localStorage.setItem(`tutorial-seen-${userId}`, 'true');
    }
    markTutorialSeenMutation.mutate();
  };

  const closeTutorial = () => {
    setShowTutorial(false);
  };

  const addPoints = (points: number) => {
    const newState: OnboardingState = {
      ...onboardingState,
      totalPoints: onboardingState.totalPoints + points,
      lastActiveDate: new Date().toISOString(),
    };
    saveOnboardingState(newState);
  };

  const unlockBadge = (badgeId: string) => {
    if (!onboardingState.unlockedBadges.includes(badgeId)) {
      const newState: OnboardingState = {
        ...onboardingState,
        unlockedBadges: [...onboardingState.unlockedBadges, badgeId],
        lastActiveDate: new Date().toISOString(),
      };
      saveOnboardingState(newState);
    }
  };

  const shouldShowTutorial = () => {
    return !onboardingState.hasCompletedTutorial;
  };

  const resetOnboarding = () => {
    saveOnboardingState(defaultOnboardingState);
    setShowTutorial(false);
  };

  return {
    onboardingState,
    showTutorial,
    startTutorial,
    completeTutorial,
    closeTutorial,
    addPoints,
    unlockBadge,
    shouldShowTutorial,
    resetOnboarding,
  };
}