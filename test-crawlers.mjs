import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Dynamic imports for TypeScript modules
async function runTests() {
  try {
    // Test OpenAI specifically first
    console.log('\n' + '='.repeat(60));
    console.log('Testing OpenAI Blog with advanced methods');
    console.log('='.repeat(60) + '\n');
    
    const response = await fetch('http://localhost:3000/api/test-crawler', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: {
          name: 'OpenAI Blog',
          url: 'https://openai.com/blog',
          selector: '.ui-list__item',
          titleSelector: '.ui-title-text',
          contentSelector: '.prose',
          linkSelector: 'a',
        }
      })
    });
    
    const result = await response.json();
    console.log('Result:', result);
  } catch (error) {
    console.error('Test failed:', error);
  }
}

runTests();