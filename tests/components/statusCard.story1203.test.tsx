import React from 'react';
const TestRenderer = require('react-test-renderer');

import StatusCard from '../../src/components/StatusCard';
import { InversionStatus } from '../../src/types';

jest.mock('react-native', () => {
  const ReactLib = require('react');

  const createHost =
    (name: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactLib.createElement(name, props, children);

  return {
    View: createHost('View'),
    Text: createHost('Text'),
    StyleSheet: {
      create: (styles: unknown) => styles,
    },
  };
});

function getCardContainerProps(tree: any) {
  return tree.root.findAllByType('View')[0].props;
}

describe('StatusCard accessibility (Story 1203)', () => {
  it('adds accessibility role and label for screen readers', () => {
    const tree = TestRenderer.create(
      React.createElement(StatusCard, {
        inversionStatus: InversionStatus.ON_TRACK,
        message: 'HRV trend is stable.',
        confidence: 'high',
        recommendation: 'Keep current monitoring cadence.',
      })
    );

    const props = getCardContainerProps(tree);

    expect(props.accessibilityRole).toBe('text');
    expect(props.accessibilityLabel).toContain('On Track');
    expect(props.accessibilityLabel).toContain('High confidence');
    expect(props.accessibilityLabel).toContain('HRV trend is stable.');
    expect(props.accessibilityLabel).toContain(
      'Recommendation: Keep current monitoring cadence.'
    );
  });

  it('omits recommendation text from accessibility label when absent', () => {
    const tree = TestRenderer.create(
      React.createElement(StatusCard, {
        inversionStatus: InversionStatus.POSSIBLE_INVERSION,
        message: 'Pattern may be changing earlier than expected.',
        confidence: 'medium',
      })
    );

    const props = getCardContainerProps(tree);

    expect(props.accessibilityRole).toBe('text');
    expect(props.accessibilityLabel).toContain('Possible Early Inversion');
    expect(props.accessibilityLabel).toContain('Medium confidence');
    expect(props.accessibilityLabel).toContain(
      'Pattern may be changing earlier than expected.'
    );
    expect(props.accessibilityLabel).not.toContain('Recommendation:');
  });
});
