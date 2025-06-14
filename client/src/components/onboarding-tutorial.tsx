import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Target, 
  TrendingUp, 
  Award, 
  Users, 
  ChevronRight, 
  ChevronLeft, 
  Star,
  Trophy,
  Gift,
  CheckCircle
} from "lucide-react";

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  target: string;
  icon: React.ReactNode;
  points: number;
  action?: string;
}

const tutorialSteps: TutorialStep[] = [
  {
    id: "welcome",
    title: "Welcome to Bets.Fun!",
    description: "Learn how to predict outcomes and earn rewards on our platform",
    target: "header",
    icon: <Gift className="h-6 w-6" />,
    points: 10
  },
  {
    id: "explore-markets",
    title: "Explore Markets",
    description: "Browse different prediction markets and see live prices",
    target: "market-grid",
    icon: <TrendingUp className="h-6 w-6" />,
    points: 15,
    action: "Click on any market card to view details"
  },
  {
    id: "place-bet",
    title: "Place Your First Bet",
    description: "Choose YES or NO on any market outcome",
    target: "betting-buttons",
    icon: <Target className="h-6 w-6" />,
    points: 25,
    action: "Click YES or NO on a market"
  },
  {
    id: "view-portfolio",
    title: "Check Your Portfolio",
    description: "Track your predictions and earnings",
    target: "portfolio-link",
    icon: <Award className="h-6 w-6" />,
    points: 15,
    action: "Navigate to Portfolio"
  },
  {
    id: "leaderboard",
    title: "Compete with Others",
    description: "See how you rank against other predictors",
    target: "leaderboard-section",
    icon: <Users className="h-6 w-6" />,
    points: 10,
    action: "Check the leaderboard"
  }
];

interface OnboardingTutorialProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (points: number) => void;
}

export default function OnboardingTutorial({ isOpen, onClose, onComplete }: OnboardingTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [showCompletion, setShowCompletion] = useState(false);

  const step = tutorialSteps[currentStep];
  const progress = ((currentStep + 1) / tutorialSteps.length) * 100;

  const handleNext = () => {
    const currentStepData = tutorialSteps[currentStep];
    
    // Mark step as completed and add points
    if (!completedSteps.includes(currentStepData.id)) {
      setCompletedSteps(prev => [...prev, currentStepData.id]);
      setTotalPoints(prev => prev + currentStepData.points);
    }

    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Tutorial completed
      setShowCompletion(true);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    setShowCompletion(true);
  };

  const handleComplete = () => {
    onComplete(totalPoints);
    onClose();
  };

  useEffect(() => {
    if (isOpen) {
      // Highlight the target element
      const targetElement = document.querySelector(`[data-tutorial="${step?.target}"]`);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetElement.classList.add('tutorial-highlight');
      }

      return () => {
        // Remove highlight when step changes
        document.querySelectorAll('.tutorial-highlight').forEach(el => {
          el.classList.remove('tutorial-highlight');
        });
      };
    }
  }, [currentStep, isOpen, step?.target]);

  if (!isOpen) return null;

  if (showCompletion) {
    return (
      <Dialog open={true} onOpenChange={handleComplete}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">
              <div className="flex items-center justify-center mb-4">
                <div className="bg-yellow-100 dark:bg-yellow-900/20 p-3 rounded-full">
                  <Trophy className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
                </div>
              </div>
              Tutorial Complete!
            </DialogTitle>
          </DialogHeader>
          <div className="text-center space-y-4">
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-4 rounded-lg">
              <div className="text-2xl font-bold text-foreground">{totalPoints} Points</div>
              <div className="text-sm text-muted-foreground">Tutorial Reward</div>
            </div>
            
            <div className="space-y-2">
              <div className="text-lg font-semibold">What's Next?</div>
              <div className="text-sm text-muted-foreground">
                Start exploring markets and making predictions to earn more points and unlock achievements!
              </div>
            </div>

            <Button onClick={handleComplete} className="w-full">Start Betting</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step.icon}
            Tutorial - Step {currentStep + 1} of {tutorialSteps.length}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Step Content */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {step.title}
                <Badge variant="secondary" className="ml-2">
                  +{step.points} pts
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">{step.description}</p>
              
              {step.action && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                  <div className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Action Required:
                  </div>
                  <div className="text-sm text-blue-700 dark:text-blue-300">
                    {step.action}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Points Summary */}
          <div className="flex items-center justify-between bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-emerald-900/20 dark:to-blue-900/20 p-3 rounded-lg">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-medium">Points Earned</span>
            </div>
            <span className="font-bold">{totalPoints}</span>
          </div>

          {/* Navigation Buttons */}
          <div className="flex justify-between">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStep === 0}
                size="sm"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              
              <Button
                variant="ghost"
                onClick={handleSkip}
                size="sm"
                className="text-muted-foreground"
              >
                Skip Tutorial
              </Button>
            </div>

            <Button onClick={handleNext} size="sm">
              {currentStep === tutorialSteps.length - 1 ? (
                <>
                  Complete
                  <CheckCircle className="h-4 w-4 ml-1" />
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Tutorial Highlight Component for targeting elements
interface TutorialHighlightProps {
  target: string;
  isActive: boolean;
}

export function TutorialHighlight({ target, isActive }: TutorialHighlightProps) {
  if (!isActive) return null;

  return (
    <div 
      className="absolute inset-0 border-2 border-blue-500 rounded-lg pointer-events-none animate-pulse"
      style={{ zIndex: 1000 }}
    />
  );
}

// Tutorial Badge Component for completed tutorials
export function TutorialBadge() {
  return (
    <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">
      <CheckCircle className="h-3 w-3 mr-1" />
      Tutorial Complete
    </Badge>
  );
}