import type { ReactNode, SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Icon({ size = 20, children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...props}>
      {children}
    </svg>
  )
}

export function AwsLambdaIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <rect x="3" y="6" width="18" height="12" rx="2" fill="#ff9900" opacity="0.2" />
      <path d="M8 14l3-5 3 3 2-4" stroke="#ff9900" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <text x="12" y="17" textAnchor="middle" fill="#ff9900" fontSize="7" fontWeight="bold">λ</text>
    </Icon>
  )
}

export function AwsS3Icon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <path d="M4 10c0-2 3.5-4 8-4s8 2 8 4-3.5 4-8 4-8-2-8-4z" fill="#ff9900" opacity="0.25" />
      <ellipse cx="12" cy="10" rx="8" ry="3" stroke="#ff9900" strokeWidth="1.5" />
      <path d="M4 10v4c0 2 3.5 4 8 4s8-2 8-4v-4" stroke="#ff9900" strokeWidth="1.5" />
      <ellipse cx="12" cy="14" rx="8" ry="3" stroke="#ff9900" strokeWidth="1.5" />
    </Icon>
  )
}

export function AwsEc2Icon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <rect x="5" y="4" width="14" height="16" rx="2" stroke="#ff9900" strokeWidth="1.5" />
      <rect x="8" y="8" width="8" height="5" rx="1" fill="#ff9900" opacity="0.3" />
      <line x1="8" y1="16" x2="16" y2="16" stroke="#ff9900" strokeWidth="1.5" strokeLinecap="round" />
    </Icon>
  )
}

export function AwsApiGatewayIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <path d="M12 4v4M8 6l4 2 4-2" stroke="#ff9900" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="6" y="10" width="12" height="8" rx="2" stroke="#ff9900" strokeWidth="1.5" />
      <path d="M10 14h4" stroke="#ff9900" strokeWidth="1.5" strokeLinecap="round" />
    </Icon>
  )
}

export function AwsSqsIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <rect x="4" y="6" width="16" height="12" rx="2" stroke="#ff9900" strokeWidth="1.5" />
      <path d="M7 10h10M7 14h7" stroke="#ff9900" strokeWidth="1.5" strokeLinecap="round" />
    </Icon>
  )
}

export function AwsSnsIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <circle cx="12" cy="12" r="3" fill="#ff9900" />
      <path d="M12 5v2M12 17v2M5 12h2M17 12h2M7.05 7.05l1.41 1.41M15.54 15.54l1.41 1.41" stroke="#ff9900" strokeWidth="1.5" strokeLinecap="round" />
    </Icon>
  )
}

export function AwsMskIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <circle cx="6" cy="12" r="2" fill="#ff9900" />
      <circle cx="12" cy="8" r="2" fill="#ff9900" />
      <circle cx="18" cy="12" r="2" fill="#ff9900" />
      <circle cx="12" cy="16" r="2" fill="#ff9900" opacity="0.5" />
      <path d="M8 11l3-2 4 2 3-2" stroke="#ff9900" strokeWidth="1.5" />
    </Icon>
  )
}

export function AwsEventBridgeIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <rect x="4" y="9" width="16" height="6" rx="3" stroke="#ff9900" strokeWidth="1.5" />
      <path d="M8 7l-2 5M16 7l2 5M12 5v4" stroke="#ff9900" strokeWidth="1.5" strokeLinecap="round" />
    </Icon>
  )
}

export function AwsRdsIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <ellipse cx="12" cy="8" rx="7" ry="3" stroke="#ff9900" strokeWidth="1.5" />
      <path d="M5 8v8c0 1.7 3.1 3 7 3s7-1.3 7-3V8" stroke="#ff9900" strokeWidth="1.5" />
      <ellipse cx="12" cy="16" rx="7" ry="3" stroke="#ff9900" strokeWidth="1.5" />
    </Icon>
  )
}

export function AwsStepFunctionsIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <circle cx="6" cy="12" r="2.5" stroke="#ff9900" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="2.5" stroke="#ff9900" strokeWidth="1.5" />
      <circle cx="18" cy="12" r="2.5" stroke="#ff9900" strokeWidth="1.5" />
      <path d="M8.5 12h1M13.5 12h1" stroke="#ff9900" strokeWidth="1.5" />
    </Icon>
  )
}

export function AwsCloudWatchIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <circle cx="12" cy="12" r="7" stroke="#ff9900" strokeWidth="1.5" />
      <path d="M12 8v4l3 2" stroke="#ff9900" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8 16c1-2 2.5-3 4-3s3 1 4 3" stroke="#ff9900" strokeWidth="1.5" strokeLinecap="round" />
    </Icon>
  )
}

export function AwsCognitoIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <circle cx="12" cy="8" r="3" stroke="#ff9900" strokeWidth="1.5" />
      <path d="M6 19c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="#ff9900" strokeWidth="1.5" />
      <path d="M16 8l2-2M8 8L6 6" stroke="#ff9900" strokeWidth="1.5" strokeLinecap="round" />
    </Icon>
  )
}

export function AzureFunctionsIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <path d="M13 3L5 13h6l-1 8 8-12h-6l1-6z" fill="#0078d4" opacity="0.85" />
    </Icon>
  )
}

export function AzureBlobIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <rect x="5" y="5" width="14" height="14" rx="3" stroke="#0078d4" strokeWidth="1.5" />
      <circle cx="10" cy="10" r="2" fill="#0078d4" opacity="0.4" />
      <circle cx="15" cy="14" r="2.5" fill="#0078d4" opacity="0.6" />
    </Icon>
  )
}

export function AzureVmIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <rect x="4" y="5" width="16" height="11" rx="2" stroke="#0078d4" strokeWidth="1.5" />
      <rect x="9" y="17" width="6" height="2" fill="#0078d4" opacity="0.5" />
      <path d="M8 9h8M8 12h5" stroke="#0078d4" strokeWidth="1.5" strokeLinecap="round" />
    </Icon>
  )
}

export function AzureApiMgmtIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <path d="M6 8h12v8H6z" stroke="#0078d4" strokeWidth="1.5" />
      <path d="M9 11h2v2H9zM13 11h2v2h-2z" fill="#0078d4" />
      <path d="M4 12h2M18 12h2" stroke="#0078d4" strokeWidth="1.5" />
    </Icon>
  )
}

export function AzureServiceBusIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <rect x="3" y="8" width="18" height="8" rx="4" stroke="#0078d4" strokeWidth="1.5" />
      <circle cx="8" cy="12" r="2" fill="#0078d4" />
      <circle cx="16" cy="12" r="2" fill="#0078d4" opacity="0.5" />
    </Icon>
  )
}

export function AzureEventHubsIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <circle cx="12" cy="12" r="3" stroke="#0078d4" strokeWidth="1.5" />
      <path d="M12 5v2M12 17v2M5 12h2M17 12h2" stroke="#0078d4" strokeWidth="1.5" />
      <path d="M7.5 7.5l1.5 1.5M15 15l1.5 1.5" stroke="#0078d4" strokeWidth="1.5" />
    </Icon>
  )
}

export function AzureLogicAppsIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <rect x="4" y="5" width="6" height="5" rx="1" stroke="#0078d4" strokeWidth="1.5" />
      <rect x="14" y="5" width="6" height="5" rx="1" stroke="#0078d4" strokeWidth="1.5" />
      <rect x="9" y="14" width="6" height="5" rx="1" stroke="#0078d4" strokeWidth="1.5" />
      <path d="M10 7.5h4M17 7.5l-2 9M7 7.5l2 9" stroke="#0078d4" strokeWidth="1.5" />
    </Icon>
  )
}

export function AzureSqlIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <ellipse cx="12" cy="7" rx="7" ry="3" stroke="#0078d4" strokeWidth="1.5" />
      <path d="M5 7v10c0 1.7 3.1 3 7 3s7-1.3 7-3V7" stroke="#0078d4" strokeWidth="1.5" />
      <path d="M9 11h6" stroke="#0078d4" strokeWidth="1.5" strokeLinecap="round" />
    </Icon>
  )
}

export function AzureKeyVaultIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <rect x="6" y="10" width="12" height="10" rx="2" stroke="#0078d4" strokeWidth="1.5" />
      <path d="M9 10V8a3 3 0 116 0v2" stroke="#0078d4" strokeWidth="1.5" />
      <circle cx="12" cy="15" r="1.5" fill="#0078d4" />
    </Icon>
  )
}

export function AzureEntraIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <circle cx="12" cy="9" r="3" stroke="#0078d4" strokeWidth="1.5" />
      <path d="M6 19c0-3 2.7-5.5 6-5.5s6 2.5 6 5.5" stroke="#0078d4" strokeWidth="1.5" />
      <path d="M12 6V4M15 7l1-1" stroke="#0078d4" strokeWidth="1.5" strokeLinecap="round" />
    </Icon>
  )
}

export function AzureDataFactoryIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <rect x="4" y="6" width="5" height="5" rx="1" fill="#0078d4" opacity="0.3" />
      <rect x="15" y="6" width="5" height="5" rx="1" fill="#0078d4" opacity="0.3" />
      <rect x="9.5" y="14" width="5" height="5" rx="1" fill="#0078d4" opacity="0.5" />
      <path d="M9 8.5h6M17.5 8.5l-3 8M6.5 8.5l3 8" stroke="#0078d4" strokeWidth="1.5" />
    </Icon>
  )
}

export function AzureAksIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <polygon points="12,4 20,20 4,20" stroke="#0078d4" strokeWidth="1.5" fill="#0078d4" fillOpacity="0.15" />
      <circle cx="12" cy="14" r="2" fill="#0078d4" />
    </Icon>
  )
}

const AWS_ICON_MAP: Record<string, (props: IconProps) => ReactNode> = {
  Lambda: AwsLambdaIcon,
  S3: AwsS3Icon,
  EC2: AwsEc2Icon,
  'API Gateway': AwsApiGatewayIcon,
  SQS: AwsSqsIcon,
  SNS: AwsSnsIcon,
  MSK: AwsMskIcon,
  EventBridge: AwsEventBridgeIcon,
  RDS: AwsRdsIcon,
  'Step Functions': AwsStepFunctionsIcon,
  CloudWatch: AwsCloudWatchIcon,
  Cognito: AwsCognitoIcon,
}

const AZURE_ICON_MAP: Record<string, (props: IconProps) => ReactNode> = {
  Functions: AzureFunctionsIcon,
  'Blob Storage': AzureBlobIcon,
  'Virtual Machines': AzureVmIcon,
  'API Management': AzureApiMgmtIcon,
  'Service Bus': AzureServiceBusIcon,
  'Event Hubs': AzureEventHubsIcon,
  'Logic Apps': AzureLogicAppsIcon,
  'SQL Database': AzureSqlIcon,
  'Key Vault': AzureKeyVaultIcon,
  'Entra ID': AzureEntraIcon,
  'Data Factory': AzureDataFactoryIcon,
  AKS: AzureAksIcon,
}

export function ServiceIcon({
  vendor,
  service,
  size = 22,
}: {
  vendor?: string
  service?: string
  size?: number
}) {
  if (!service) return null

  if (vendor === 'AWS' || vendor?.includes('AWS')) {
    const IconComponent = AWS_ICON_MAP[service]
    if (IconComponent) return <IconComponent size={size} />
  }

  if (vendor?.includes('Azure') || vendor?.includes('Microsoft')) {
    const IconComponent = AZURE_ICON_MAP[service]
    if (IconComponent) return <IconComponent size={size} />
  }

  return null
}

export function getServiceIconFromLabel(label: string, systemType: string): ReactNode | null {
  const awsMatch = AWS_ICON_MAP[label.replace('Amazon ', '').replace('AWS ', '')]
  if (systemType === 'aws') {
    for (const [key, Icon] of Object.entries(AWS_ICON_MAP)) {
      if (label.includes(key)) return <Icon size={22} />
    }
  }
  if (systemType === 'azure') {
    for (const [key, Icon] of Object.entries(AZURE_ICON_MAP)) {
      if (label.includes(key) || label.includes(key.replace('Azure ', ''))) return <Icon size={22} />
    }
  }
  if (awsMatch) return awsMatch({ size: 22 })
  return null
}