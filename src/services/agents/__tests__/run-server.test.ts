import {
  geminiDeclarations,
  geminiModelPartsFromCalls,
  parseAgentRunInput,
  parseGeminiTurn,
} from '../run-server';

describe('agent run server', () => {
  it('accepts a user message plus tool specs', () => {
    expect(
      parseAgentRunInput({
        message: 'Add milk',
        tools: [{ id: 'add_task', description: 'Add a task' }],
      }),
    ).toMatchObject({
      message: 'Add milk',
      tools: [{ id: 'add_task', description: 'Add a task' }],
    });
  });

  it('rejects an empty payload', () => {
    expect(parseAgentRunInput({})).toBeNull();
  });

  it('strips additionalProperties so Gemini function declarations stay valid', () => {
    const declarations = geminiDeclarations([
      {
        id: 'get_today',
        description: 'List today’s calendar activities.',
        parameters: { type: 'object', additionalProperties: false },
      },
      {
        id: 'search_app',
        description: 'Search screens',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: { query: { type: 'string', additionalProperties: false } },
          required: ['query'],
        },
      },
    ]);
    expect(JSON.stringify(declarations)).not.toContain('additionalProperties');
    expect(declarations[0]?.parameters).toEqual({ type: 'object', properties: {} });
    expect(declarations[1]?.parameters).toEqual({
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    });
  });

  it('echoes Gemini thought signatures on the next tool turn', () => {
    const turn = parseGeminiTurn({
      candidates: [
        {
          content: {
            parts: [
              {
                functionCall: { name: 'list_trips', args: { query: 'next' } },
                thoughtSignature: 'sig-list-trips',
              },
              { functionCall: { name: 'get_today', args: {} } },
            ],
          },
        },
      ],
    });
    expect(turn).toMatchObject({
      type: 'tool_calls',
      calls: [
        {
          name: 'list_trips',
          arguments: { query: 'next' },
          thoughtSignature: 'sig-list-trips',
        },
        { name: 'get_today', arguments: {} },
      ],
    });
    expect(turn.type === 'tool_calls' ? turn.calls[1]?.thoughtSignature : 'missing').toBeUndefined();

    const parts = geminiModelPartsFromCalls(turn.type === 'tool_calls' ? turn.calls : []);
    expect(parts).toEqual([
      {
        functionCall: { name: 'list_trips', args: { query: 'next' } },
        thoughtSignature: 'sig-list-trips',
      },
      { functionCall: { name: 'get_today', args: {} } },
    ]);
    expect(JSON.stringify(parts[1])).not.toContain('thoughtSignature');
  });

  it('attaches a thought signature from a preceding thought part to the first function call', () => {
    const turn = parseGeminiTurn({
      candidates: [
        {
          content: {
            parts: [
              { thoughtSignature: 'sig-thought' },
              { functionCall: { name: 'list_trips', args: {} } },
            ],
          },
        },
      ],
    });
    expect(turn).toMatchObject({
      type: 'tool_calls',
      calls: [{ name: 'list_trips', thoughtSignature: 'sig-thought' }],
    });
  });

  it('round-trips thought signatures through parseAgentRunInput', () => {
    expect(
      parseAgentRunInput({
        tools: [{ id: 'list_trips', description: 'List trips' }],
        pendingCalls: [
          {
            id: 'tool-1',
            name: 'list_trips',
            arguments: {},
            thoughtSignature: 'sig-list-trips',
          },
        ],
      })?.pendingCalls,
    ).toEqual([
      {
        id: 'tool-1',
        name: 'list_trips',
        arguments: {},
        thoughtSignature: 'sig-list-trips',
      },
    ]);
  });
});
