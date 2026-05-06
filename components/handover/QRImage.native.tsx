import QRCode from 'react-native-qrcode-svg';

interface Props {
  value: string;
  size?: number;
}

// Native: react-native-qrcode-svg renders via react-native-svg which
// is a first-class native dependency.
export default function QRImage({ value, size = 220 }: Props) {
  return (
    <QRCode
      value={value}
      size={size}
      backgroundColor="#FFFFFF"
      color="#0F172A"
    />
  );
}
