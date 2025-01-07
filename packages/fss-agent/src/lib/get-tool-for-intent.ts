// Import the OpenAI class from the 'openai' package.
import { OpenAI } from 'openai';

// Import functions and types from the '@lit-protocol/fss-tool-registry' package.
import {
  listToolsByNetwork,
  type LitNetwork,
} from '@lit-protocol/fss-tool-registry';

// Import the FssTool type from the '@lit-protocol/fss-tool' package.
import type { FssTool } from '@lit-protocol/fss-tool';

// Import a helper function to generate a prompt for tool matching.
import { getToolMatchingPrompt } from './get-tool-matching-prompt';

/**
 * Matches a user's intent to an appropriate tool from the available tools on a specified Lit network.
 * This function uses OpenAI's API to analyze the intent and recommend a tool.
 *
 * @param openai - An instance of the OpenAI client.
 * @param openAiModel - The name of the OpenAI model to use for analysis.
 * @param userIntent - The user's intent as a string (e.g., "I want to mint an NFT").
 * @param litNetwork - The Lit network to use for filtering available tools.
 * @returns A Promise that resolves to an object containing:
 *   - analysis: The raw analysis result from OpenAI, parsed as a JSON object.
 *   - matchedTool: The tool matched to the user's intent, or `null` if no match is found.
 */
export async function getToolForIntent(
  openai: OpenAI,
  openAiModel: string,
  userIntent: string,
  litNetwork: LitNetwork
): Promise<{
  analysis: any;
  matchedTool: FssTool | null;
}> {
  // Retrieve the list of tools available on the specified Lit network.
  const availableTools = listToolsByNetwork(litNetwork);

  // Use OpenAI's API to analyze the user's intent and recommend a tool.
  const completion = await openai.chat.completions.create({
    model: openAiModel,
    messages: [
      {
        role: 'system',
        content: getToolMatchingPrompt(availableTools), // Generate a prompt for tool matching.
      },
      {
        role: 'user',
        content: userIntent, // Provide the user's intent as input.
      },
    ],
    response_format: { type: 'json_object' }, // Request the response in JSON format.
  });

  // Parse the analysis result from OpenAI's response.
  const analysis = JSON.parse(completion.choices[0].message.content || '{}');

  // Find the matched tool based on the recommended CID from the analysis.
  const matchedTool = analysis.recommendedCID
    ? availableTools.find((tool) => tool.ipfsCid === analysis.recommendedCID) ||
      null
    : null;

  // Return the analysis and the matched tool (or null if no match is found).
  return { analysis, matchedTool };
}
