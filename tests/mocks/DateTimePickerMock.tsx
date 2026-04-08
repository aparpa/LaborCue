import React from 'react';
import { Text } from 'react-native';

// Lightweight mock for the native date-time picker used in tests
export default function DateTimePickerMock(props: any): JSX.Element {
  return <Text testID="date-time-picker" {...props} />;
}
