# Subagent: Intent Parsing and Tool Matching

Subagent is a utility that uses OpenAI to parse user intents and match them to the appropriate tools. It’s designed to simplify the process of understanding user requests and mapping them to the correct tools in a web3 environment.

## How It Works

1. **Intent Matching**: Subagent analyzes a user’s intent (e.g., "I want to mint an NFT") and matches it to a registered tool.
2. **Parameter Parsing**: If a tool is matched, Subagent extracts and validates the required parameters from the user’s intent.
3. **OpenAI Integration**: It uses OpenAI’s API to perform intent analysis and parameter extraction.

## Example Usage

```typescript
import { OpenAiIntentMatcher } from './agent';
import type { AwTool } from '@lit-protocol/aw-tool';

// Initialize Subagent
const apiKey = 'your-openai-api-key';
const intentMatcher = new OpenAiIntentMatcher(apiKey);

// Register tools
const registeredTools: AwTool<any, any>[] = [
  {
    name: 'MintNFT',
    description: 'Mint a new NFT',
    ipfsCid: 'QmExampleCID1',
    parameters: {
      descriptions: {
        tokenId: 'The ID of the token to mint',
        recipient: 'The address of the recipient',
      },
      schema: {}, // Zod schema for validation
      validate: (params) => true, // Validation logic
    },
  },
  // Add more tools as needed
];

// Analyze user intent
const userIntent = "I want to mint an NFT with token ID 123 to address 0x123...";
const result = await intentMatcher.analyzeIntentAndMatchTool(userIntent, registeredTools);

// Check results
if (result.matchedTool) {
  console.log('Matched Tool:', result.matchedTool.name);
  console.log('Found Parameters:', result.params.foundParams);
  console.log('Missing Parameters:', result.params.missingParams);
} else {
  console.log('No matching tool found.');
}
```
Key Features

    Intent Matching: Matches user intents to registered tools.

    Parameter Extraction: Parses and validates parameters from the user’s intent.

    OpenAI Integration: Uses OpenAI for accurate intent analysis.

Conclusion

Subagent makes it easy to parse user intents and match them to the right tools, ensuring seamless execution in web3 workflows.
