import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

interface BetData {
  id: number;
  side: boolean;
  amount: string;
  shares: string;
  createdAt: string;
  price: string;
}

interface BettingChartProps {
  bets: BetData[];
}

interface ChartDataPoint {
  timestamp: number;
  date: string;
  yesBets: number;
  noBets: number;
  yesVolume: number;
  noVolume: number;
}

export default function BettingChart({ bets }: BettingChartProps) {
  // Process bets into chart data
  const chartData: ChartDataPoint[] = [];
  
  if (bets.length === 0) {
    // Show empty state
    return (
      <div className="h-96 bg-muted/20 rounded-lg flex items-center justify-center border-2 border-dashed border-muted">
        <div className="text-center text-muted-foreground">
          <div className="text-lg font-medium mb-2">Betting Activity</div>
          <div className="text-sm">Chart will appear once bets are placed</div>
        </div>
      </div>
    );
  }

  // Sort bets by date
  const sortedBets = [...bets].sort((a, b) => 
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  // Group bets by time intervals and accumulate counts
  let yesCount = 0;
  let noCount = 0;
  let yesVolume = 0;
  let noVolume = 0;
  
  sortedBets.forEach((bet, index) => {
    const timestamp = new Date(bet.createdAt).getTime();
    // Shares contains the net amount that actually went into the pool
    const netAmount = parseFloat(bet.shares);
    
    if (bet.side) {
      yesCount++;
      yesVolume += netAmount;
    } else {
      noCount++;
      noVolume += netAmount;
    }
    
    // Add data point for every bet or at key intervals
    if (index === 0 || index === sortedBets.length - 1 || index % Math.max(1, Math.floor(sortedBets.length / 20)) === 0) {
      chartData.push({
        timestamp,
        date: format(new Date(timestamp), 'MMM dd, HH:mm'),
        yesBets: yesCount,
        noBets: noCount,
        yesVolume: yesVolume,
        noVolume: noVolume
      });
    }
  });

  // Ensure we have the final data point
  if (chartData.length > 0 && sortedBets.length > 0) {
    const lastBet = sortedBets[sortedBets.length - 1];
    const lastBetTimestamp = new Date(lastBet.createdAt).getTime();
    const lastChartTimestamp = chartData[chartData.length - 1].timestamp;
    
    if (lastChartTimestamp !== lastBetTimestamp) {
      chartData.push({
        timestamp: lastBetTimestamp,
        date: format(new Date(lastBetTimestamp), 'MMM dd, HH:mm'),
        yesBets: yesCount,
        noBets: noCount,
        yesVolume: yesVolume,
        noVolume: noVolume
      });
    }
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value} bets
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-96 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 20,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis 
            dataKey="date"
            fontSize={12}
            tick={{ fill: 'currentColor' }}
            axisLine={{ stroke: 'currentColor', opacity: 0.3 }}
          />
          <YAxis 
            fontSize={12}
            tick={{ fill: 'currentColor' }}
            axisLine={{ stroke: 'currentColor', opacity: 0.3 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Line
            type="monotone"
            dataKey="yesBets"
            stroke="#10b981"
            strokeWidth={3}
            name="YES Bets"
            dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: '#10b981', strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey="noBets"
            stroke="#ef4444"
            strokeWidth={3}
            name="NO Bets"
            dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: '#ef4444', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}