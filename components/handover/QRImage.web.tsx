import { QRCodeSVG } from 'qrcode.react';

interface Props {
  value: string;
  size?: number;
}

// Web: react-native-qrcode-svg ships SVG primitives that depend on
// react-native-svg; on react-native-web that bridge is flaky and the
// QR ends up empty. qrcode.react renders raw SVG and just works.
export default function QRImage({ value, size = 220 }: Props) {
  return (
    <QRCodeSVG
      value={value}
      size={size}
      bgColor="#FFFFFF"
      fgColor="#0F172A"
      level="M"
    />
  );
}
