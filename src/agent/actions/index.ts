import * as navigationActions from './navigation.actions';
import * as dataActions from './data.actions';
import * as systemActions from './system.actions';
import * as interactionActions from './interaction.actions';

export const actionRegistry = {
  ...navigationActions,
  ...dataActions,
  ...systemActions,
  ...interactionActions,
};

export type ActionName = keyof typeof actionRegistry;