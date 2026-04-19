import { Injectable } from '@nestjs/common';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

@Injectable()
export class BedrockService {
  private client = new BedrockRuntimeClient({ region: 'us-west-2' });

  async generateMeetingDescription(meetingName: string): Promise<string> {
    const command = new InvokeModelCommand({
      modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `Write a concise 1-2 sentence meeting description for a meeting called "${meetingName}". Be professional and specific. Output only the description, nothing else.`
        }]
      })
    });

    const response = await this.client.send(command);
    const result = JSON.parse(Buffer.from(response.body).toString());
    return result.content[0].text;
  }
}