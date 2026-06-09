import { useState } from 'react';
import { LayoutTemplate, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ViewMode } from '@/lib/view-mode';

export interface PresetConfig {
  mode: ViewMode;
  activeTab: string;
  expandedCards: string[];
  hiddenSections: string[];
}

interface WorkspacePresetProps {
  currentMode: ViewMode;
  onApplyPreset: (preset: PresetConfig) => void;
  onClose: () => void;
}

const PRESETS: { id: ViewMode; name: string; description: string; config: PresetConfig }[] = [
  {
    id: 'simple',
    name: 'Simple',
    description: 'Only the essentials — perfect for daily use and new team members',
    config: {
      mode: 'simple',
      activeTab: 'staff-training',
      expandedCards: ['live-use-rehearsal', 'staff-training', 'incident-register'],
      hiddenSections: [
        'vendor-credential', 'production-config', 'operator-health',
        'restore-drill', 'production-rehearsal', 'integration-events',
        'browser-qa', 'system-integration', 'document-storage',
        'policy-approval', 'cutover-readiness', 'cutover-runbook',
      ],
    },
  },
  {
    id: 'standard',
    name: 'Standard',
    description: 'The full workflow view — most commonly used by practice managers',
    config: {
      mode: 'standard',
      activeTab: 'compliance-security',
      expandedCards: ['credential-binder', 'go-live-packet', 'incident-register'],
      hiddenSections: [
        'vendor-credential', 'production-config', 'operator-health',
        'restore-drill', 'production-rehearsal',
      ],
    },
  },
  {
    id: 'power',
    name: 'Power',
    description: 'Everything visible — for admins and deep troubleshooting',
    config: {
      mode: 'power',
      activeTab: 'go-live',
      expandedCards: [
        'live-use-rehearsal', 'staff-training', 'credential-binder',
        'browser-qa', 'system-integration', 'cutover-readiness',
        'go-live-packet', 'incident-register',
      ],
      hiddenSections: [],
    },
  },
];

export function WorkspacePreset({ currentMode, onApplyPreset, onClose }: WorkspacePresetProps) {
  const [selected, setSelected] = useState<ViewMode>(currentMode);

  return (
    <div className="fixed inset-0 z-50 bg-ink/20 p-4 backdrop-blur-sm flex items-center justify-center" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-lg border border-border bg-canvas-raised shadow-lg p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-5">
          <LayoutTemplate className="h-5 w-5 text-accent" />
          <h2 className="text-headline font-semibold text-ink">Workspace Preset</h2>
        </div>
        <p className="text-small text-ink-muted mb-4">
          Choose a preset to quickly configure your Operations view.
        </p>
        <div className="space-y-3">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => setSelected(preset.id)}
              className={cn(
                'w-full text-left rounded-lg border p-4 transition-colors',
                selected === preset.id
                  ? 'border-accent bg-accent-soft'
                  : 'border-border bg-canvas hover:bg-canvas-sunk'
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn('text-small font-semibold', selected === preset.id ? 'text-accent' : 'text-ink')}>
                  {preset.name}
                </span>
                {selected === preset.id && <Check className="h-4 w-4 text-accent" />}
              </div>
              <p className="text-micro text-ink-muted mt-1">{preset.description}</p>
            </button>
          ))}
        </div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-small font-medium text-ink-secondary hover:bg-canvas-sunk transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              const preset = PRESETS.find((p) => p.id === selected);
              if (preset) onApplyPreset(preset.config);
              onClose();
            }}
            className="rounded-md bg-accent px-4 py-2 text-small font-medium text-accent-on hover:bg-accent-hover transition-colors"
          >
            Apply Preset
          </button>
        </div>
      </div>
    </div>
  );
}
