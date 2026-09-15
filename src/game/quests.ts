import type { Quest, QuestId, QuestStatus } from './types';

const STARTER: Omit<Quest, 'status'>[] = [
  {
    id: 'blvd-cross',
    title: 'Cross Queens Blvd',
    hint: 'Use a crosswalk and reach the Blvd plaza marker',
  },
  {
    id: 'bodega-run',
    title: 'Bodega grocery run',
    hint: 'Find the red awning bodega in Rego Park',
  },
  {
    id: 'subway-stop',
    title: 'Forest Hills subway',
    hint: 'Make it to the subway entrance plaza',
  },
];

export class QuestLog {
  quests: Quest[];

  constructor() {
    this.quests = STARTER.map((q) => ({ ...q, status: 'active' as QuestStatus }));
  }

  get(id: QuestId): Quest | undefined {
    return this.quests.find((q) => q.id === id);
  }

  complete(id: QuestId): boolean {
    const q = this.get(id);
    if (!q || q.status === 'completed') return false;
    q.status = 'completed';
    return true;
  }

  completedCount(): number {
    return this.quests.filter((q) => q.status === 'completed').length;
  }

  allDone(): boolean {
    return this.completedCount() === this.quests.length;
  }

  reset() {
    this.quests = STARTER.map((q) => ({ ...q, status: 'active' as QuestStatus }));
  }
}
