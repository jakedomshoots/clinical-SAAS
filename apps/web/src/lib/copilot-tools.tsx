import { useFrontendTool } from '@copilotkit/react-core/v2';
import { z } from 'zod';
import {
  ASSISTANT_TOOL_DEFINITIONS,
  ASSISTANT_TOOL_IDS,
  getAssistantCopilotActionDescriptors,
  type AssistantToolId,
} from '@/lib/assistant-tools';

const confirmationParameters = z.object({
  context: z
    .string()
    .describe('The route, patient, queue, or clinical context for the proposed action.'),
  rationale: z
    .string()
    .optional()
    .describe('Short explanation of why this action should be staged.'),
});

type ConfirmationArgs = z.infer<typeof confirmationParameters>;

function confirmationResponse(toolId: AssistantToolId, args: ConfirmationArgs) {
  const definition = ASSISTANT_TOOL_DEFINITIONS[toolId];

  return {
    status: 'confirmation_required',
    toolId,
    title: definition.name,
    context: args.context,
    rationale: args.rationale ?? null,
    nextStep:
      'Open the Concierge OS clinical assistant panel and confirm the matching action before any patient data is changed.',
  };
}

export function CopilotClinicalToolRegistry() {
  useFrontendTool(
    {
      name: ASSISTANT_TOOL_IDS.CREATE_FOLLOW_UP_TASK,
      description:
        'Stages a follow-up task from clinical context. Requires staff confirmation before creation.',
      parameters: confirmationParameters,
      handler: async (args) => confirmationResponse(ASSISTANT_TOOL_IDS.CREATE_FOLLOW_UP_TASK, args),
    },
    []
  );

  useFrontendTool(
    {
      name: ASSISTANT_TOOL_IDS.DRAFT_PORTAL_REPLY,
      description:
        'Stages a portal reply draft. Requires staff confirmation and never sends automatically.',
      parameters: confirmationParameters,
      handler: async (args) => confirmationResponse(ASSISTANT_TOOL_IDS.DRAFT_PORTAL_REPLY, args),
    },
    []
  );

  useFrontendTool(
    {
      name: ASSISTANT_TOOL_IDS.STAGE_FAX_MATCH,
      description:
        'Stages a fax-to-patient match for staff review. Requires staff confirmation before changing the fax.',
      parameters: confirmationParameters,
      handler: async (args) => confirmationResponse(ASSISTANT_TOOL_IDS.STAGE_FAX_MATCH, args),
    },
    []
  );

  getAssistantCopilotActionDescriptors();

  return null;
}
