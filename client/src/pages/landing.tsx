import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, Users, DollarSign, Trophy } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="bg-gradient-to-r from-primary to-secondary text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24">
            <div className="text-center">
              <div className="flex flex-col sm:flex-row items-center justify-center mb-6 sm:mb-8">
                <TrendingUp className="h-12 w-12 sm:h-16 sm:w-16 mb-4 sm:mb-0 sm:mr-4 text-white" />
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white">Bets.Fun</h1>
              </div>
              <p className="text-lg sm:text-xl text-white/90 mb-6 sm:mb-8 max-w-3xl mx-auto px-2">
                The world's most accurate prediction market platform. Trade on the outcome of future events 
                and earn rewards for your forecasting skills.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4">
                <Button 
                  size="lg" 
                  className="bg-white text-primary hover:bg-gray-100 font-semibold text-lg px-6 sm:px-8 py-3 sm:py-4 w-full sm:w-auto"
                  onClick={() => window.location.href = '/api/login'}
                >
                  Get Started
                </Button>
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="border-white text-white hover:bg-white/10 font-semibold text-lg px-6 sm:px-8 py-3 sm:py-4 w-full sm:w-auto"
                >
                  Learn More
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-16 sm:py-20 lg:py-24 bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-card-foreground mb-4">Why Choose Bets.Fun?</h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
              Join thousands of traders making accurate predictions on politics, sports, technology, and more.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            <Card className="text-center p-4 sm:p-6 hover:shadow-lg transition-shadow bg-card border-border">
              <CardContent className="pt-4 sm:pt-6">
                <div className="bg-primary/10 p-3 sm:p-4 rounded-lg inline-block mb-3 sm:mb-4">
                  <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold mb-2 text-card-foreground">Real-Time Markets</h3>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Trade on live prediction markets with real-time price updates and market depth.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center p-4 sm:p-6 hover:shadow-lg transition-shadow bg-card border-border">
              <CardContent className="pt-4 sm:pt-6">
                <div className="bg-success/10 p-3 sm:p-4 rounded-lg inline-block mb-3 sm:mb-4">
                  <Users className="h-6 w-6 sm:h-8 sm:w-8 text-success" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold mb-2 text-card-foreground">Community Driven</h3>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Join a community of expert forecasters and learn from the wisdom of crowds.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center p-4 sm:p-6 hover:shadow-lg transition-shadow bg-card border-border">
              <CardContent className="pt-4 sm:pt-6">
                <div className="bg-secondary/10 p-3 sm:p-4 rounded-lg inline-block mb-3 sm:mb-4">
                  <DollarSign className="h-6 w-6 sm:h-8 sm:w-8 text-secondary" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold mb-2 text-card-foreground">Earn Rewards</h3>
                <p className="text-sm sm:text-base text-muted-foreground">
                  Get rewarded for accurate predictions with real monetary returns on your forecasts.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center p-4 sm:p-6 hover:shadow-lg transition-shadow bg-card border-border">
              <CardContent className="pt-4 sm:pt-6">
                <div className="bg-error/10 p-3 sm:p-4 rounded-lg inline-block mb-3 sm:mb-4">
                  <Trophy className="h-6 w-6 sm:h-8 sm:w-8 text-error" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold mb-2 text-card-foreground">Transparent</h3>
                <p className="text-sm sm:text-base text-muted-foreground">
                  All markets are publicly auditable with clear resolution criteria and outcomes.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-background py-16 sm:py-20 lg:py-24">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">Ready to Start Predicting?</h2>
          <p className="text-base sm:text-lg text-muted-foreground mb-6 sm:mb-8 px-2">
            Join Bets.Fun today and turn your insights into profits.
          </p>
          <Button 
            size="lg" 
            className="bg-primary hover:bg-secondary text-white font-semibold text-lg px-6 sm:px-8 py-3 sm:py-4 w-full sm:w-auto"
            onClick={() => window.location.href = '/api/login'}
          >
            Sign Up Now
          </Button>
        </div>
      </div>
    </div>
  );
}
