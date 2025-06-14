import { db } from './db.js';
import { categories, markets, users } from '../shared/schema.js';

async function populateSampleData() {
  try {
    console.log('Creating sample categories...');
    
    // Create categories
    const categoryData = [
      { name: 'Politics', description: 'Political events and elections', color: '#3B82F6' },
      { name: 'Sports', description: 'Sports predictions and outcomes', color: '#10B981' },
      { name: 'Technology', description: 'Tech industry and innovation', color: '#8B5CF6' },
      { name: 'Economics', description: 'Economic indicators and markets', color: '#F59E0B' },
      { name: 'Entertainment', description: 'Movies, TV, and celebrity events', color: '#EF4444' }
    ];

    const createdCategories = await db.insert(categories).values(categoryData).returning();
    console.log('Categories created:', createdCategories.length);

    // Create a sample user for market creation
    const sampleUser = await db.insert(users).values({
      id: 'sample-user-123',
      email: 'demo@predictmarket.com',
      firstName: 'Demo',
      lastName: 'User',
      balance: '10000.00'
    }).onConflictDoNothing().returning();

    console.log('Creating sample markets...');

    // Create sample markets
    const marketData = [
      {
        title: 'Will Bitcoin reach $100,000 by end of 2024?',
        description: 'Bitcoin has been volatile this year. Will it break the $100k barrier before December 31st, 2024?',
        categoryId: createdCategories.find(c => c.name === 'Economics')?.id || 1,
        creatorId: 'sample-user-123',
        endDate: new Date('2024-12-31'),
        yesPrice: '0.35',
        noPrice: '0.65',
        totalVolume: '125000.00',
        participantCount: 1247,
        featured: true
      },
      {
        title: 'Will Taylor Swift win a Grammy at the 2024 ceremony?',
        description: 'Taylor Swift has been nominated for multiple categories. Will she take home at least one Grammy award?',
        categoryId: createdCategories.find(c => c.name === 'Entertainment')?.id || 1,
        creatorId: 'sample-user-123',
        endDate: new Date('2024-02-04'),
        yesPrice: '0.78',
        noPrice: '0.22',
        totalVolume: '89500.00',
        participantCount: 892
      },
      {
        title: 'Will OpenAI release GPT-5 in 2024?',
        description: 'OpenAI has been working on their next generation model. Will they officially release GPT-5 this year?',
        categoryId: createdCategories.find(c => c.name === 'Technology')?.id || 1,
        creatorId: 'sample-user-123',
        endDate: new Date('2024-12-31'),
        yesPrice: '0.42',
        noPrice: '0.58',
        totalVolume: '67800.00',
        participantCount: 543
      },
      {
        title: 'Will the Democrats win the 2024 Presidential Election?',
        description: 'The 2024 presidential race is heating up. Will the Democratic candidate win the presidency?',
        categoryId: createdCategories.find(c => c.name === 'Politics')?.id || 1,
        creatorId: 'sample-user-123',
        endDate: new Date('2024-11-05'),
        yesPrice: '0.51',
        noPrice: '0.49',
        totalVolume: '2340000.00',
        participantCount: 15672
      },
      {
        title: 'Will Lionel Messi score 30+ goals this season?',
        description: 'Messi continues to perform at the highest level. Will he reach 30 goals across all competitions this season?',
        categoryId: createdCategories.find(c => c.name === 'Sports')?.id || 1,
        creatorId: 'sample-user-123',
        endDate: new Date('2024-05-30'),
        yesPrice: '0.67',
        noPrice: '0.33',
        totalVolume: '45200.00',
        participantCount: 356
      },
      {
        title: 'Will Apple announce a foldable iPhone in 2024?',
        description: 'Rumors suggest Apple is working on foldable technology. Will they announce a foldable iPhone this year?',
        categoryId: createdCategories.find(c => c.name === 'Technology')?.id || 1,
        creatorId: 'sample-user-123',
        endDate: new Date('2024-12-31'),
        yesPrice: '0.23',
        noPrice: '0.77',
        totalVolume: '34600.00',
        participantCount: 298
      }
    ];

    const createdMarkets = await db.insert(markets).values(marketData).returning();
    console.log('Markets created:', createdMarkets.length);

    console.log('Sample data populated successfully!');
    console.log('Categories:', createdCategories.length);
    console.log('Markets:', createdMarkets.length);

  } catch (error) {
    console.error('Error populating sample data:', error);
  }
  
  process.exit(0);
}

populateSampleData();