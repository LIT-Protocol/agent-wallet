// Import the OpenAI class from the 'openai' package.
import { OpenAI } from 'openai';
import type {
  IntentMatcher,
  IntentMatcherResponse,
} from '@lit-protocol/aw-signer';
import type { AwTool } from '@lit-protocol/aw-tool';

// Import helper functions for matching tools and parsing parameters based on intent.
import { getToolForIntent } from './get-tool-for-intent';
import { parseToolParametersFromIntent } from './parse-tool-parameters';

/**
 * A class that implements the `IntentMatcher` interface to match intents using OpenAI's API.
 * This class is responsible for analyzing an intent, matching it to a registered tool,
 * and parsing the required parameters for the matched tool.
 */
export class OpenAiIntentMatcher implements IntentMatcher {
  
  private static MATCHER_NAME = 'OpenAI Intent Matcher';
  private static REQUIRED_CREDENTIALS = ['openAiApiKey'] as const;
  
  // /** The name of the intent matcher. */
  public static get name() {
    return OpenAiIntentMatcher.MATCHER_NAME;
  }
  
  // /** The required credential names for this intent matcher. */
  public static get requiredCredentialNames() {
    return OpenAiIntentMatcher.REQUIRED_CREDENTIALS;
  }

  /** The OpenAI client instance. */
  private openai: OpenAI;

  /** The model to be used for intent analysis. */
  private model: string;

  /**
   * Constructs an instance of the `OpenAiIntentMatcher`.
   * 
   * @param {string} apiKey - The API key for the OpenAI client.
   * @param {string} [model='gpt-4o-mini'] - The model to be used for intent analysis. Defaults to 'gpt-4o-mini'.
   */
  constructor(apiKey: string, model = 'gpt-4o-mini') {
    this.openai = new OpenAI({ apiKey: apiKey });
    this.model = model;
  }

  /**
   * Analyzes the provided intent and matches it to a registered tool.
   * If a tool is matched, it also parses the required parameters from the intent.
   * 
   * @param {string} intent - The intent to be analyzed.
   * @param {AwTool<any, any>[]} registeredTools - An array of registered tools to match against the intent.
   * @returns {Promise<IntentMatcherResponse<any>>} - A promise that resolves to an object containing the analysis, matched tool, and parameters.
   * @throws {Error} - Throws an error if the OpenAI client is not initialized.
   */
  public async analyzeIntentAndMatchTool(
    intent: string,
    registeredTools: AwTool<any, any>[]
  ): Promise<IntentMatcherResponse<any>> {
    if (!this.openai) {
      throw new Error(
        'OpenAI client not initialized. Please set credentials first.'
      );
    }

    // Match the intent to a tool using the OpenAI client and model.
    const { analysis, matchedTool } = await getToolForIntent(
      this.openai,
      this.model,
      intent,
      registeredTools
    );

    // If a tool is matched, parse the parameters from the intent.
    const params = matchedTool
      ? await parseToolParametersFromIntent(
          this.openai,
          this.model,
          intent,
          matchedTool
        )
      : { foundParams: {}, missingParams: [] }; // If no tool is matched, return empty parameters.

    // Return the analysis, matched tool, and parameters.
    return { analysis, matchedTool, params };
  }
}
