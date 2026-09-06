import type { ReactNode, SVGProps } from 'react'
import { AZURE_SERVICE_FAMILY, type AzureIconFamily } from '../../data/azurePalette'

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

export function JiraIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <path d="M12 3l7 7-7 7-7-7 7-7z" fill="#1868DB" opacity="0.2" />
      <path d="M12 6.5c2.2 2.2 2.2 5.8 0 8" stroke="#1868DB" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 4c3.6 3.2 3.6 8.8 0 12" stroke="#2684FF" strokeWidth="1.8" strokeLinecap="round" />
    </Icon>
  )
}

export function AzureDevOpsIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <path d="M6 9l4-5 8 3v10l-8 3-4-4 8 1V8L10 9v6L6 13V9z" fill="#0078d4" />
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

const AZ = '#0078d4'

export function AzureGenericIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" fill={AZ} fillOpacity="0.18" stroke={AZ} strokeWidth="1.5" />
      <path d="M12 8v8M9 10.5h6" stroke={AZ} strokeWidth="1.5" strokeLinecap="round" />
    </Icon>
  )
}

export function AzureComputeFamilyIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <rect x="4" y="5" width="16" height="12" rx="2" stroke={AZ} strokeWidth="1.5" />
      <path d="M8 9h8M8 12h5" stroke={AZ} strokeWidth="1.4" strokeLinecap="round" />
      <rect x="9" y="18" width="6" height="1.6" fill={AZ} opacity="0.7" />
    </Icon>
  )
}

export function AzureContainersFamilyIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <rect x="4" y="7" width="7" height="10" rx="1.2" stroke={AZ} strokeWidth="1.4" />
      <rect x="13" y="7" width="7" height="10" rx="1.2" stroke={AZ} strokeWidth="1.4" />
      <path d="M6 10h3M15 10h3M6 13h3" stroke={AZ} strokeWidth="1.3" strokeLinecap="round" />
    </Icon>
  )
}

export function AzureNetworkingFamilyIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <circle cx="6" cy="12" r="2.2" fill={AZ} />
      <circle cx="18" cy="7" r="2.2" fill={AZ} opacity="0.75" />
      <circle cx="18" cy="17" r="2.2" fill={AZ} opacity="0.75" />
      <path d="M8 11.2l8-3.2M8 12.8l8 3.2" stroke={AZ} strokeWidth="1.4" />
    </Icon>
  )
}

export function AzureStorageFamilyIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <ellipse cx="12" cy="8" rx="7" ry="2.6" stroke={AZ} strokeWidth="1.4" />
      <path d="M5 8v8c0 1.5 3.1 2.6 7 2.6s7-1.1 7-2.6V8" stroke={AZ} strokeWidth="1.4" />
    </Icon>
  )
}

export function AzureIdentityFamilyIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <circle cx="12" cy="8" r="3" stroke={AZ} strokeWidth="1.4" />
      <path d="M6 19c0-3.2 2.7-5.5 6-5.5s6 2.3 6 5.5" stroke={AZ} strokeWidth="1.4" />
    </Icon>
  )
}

export function AzureSecurityFamilyIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <path d="M12 3l7 3v6c0 4.2-2.8 7.2-7 8.5C7.8 19.2 5 16.2 5 12V6l7-3z" stroke={AZ} strokeWidth="1.4" fill={AZ} fillOpacity="0.12" />
      <path d="M9.5 12.2l1.8 1.8 3.4-3.6" stroke={AZ} strokeWidth="1.5" strokeLinecap="round" />
    </Icon>
  )
}

export function AzureIntegrationFamilyIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <rect x="3" y="8" width="7" height="8" rx="1.4" stroke={AZ} strokeWidth="1.4" />
      <rect x="14" y="8" width="7" height="8" rx="1.4" stroke={AZ} strokeWidth="1.4" />
      <path d="M10 12h4M14 12l-1.4-1.4M14 12l-1.4 1.4" stroke={AZ} strokeWidth="1.4" strokeLinecap="round" />
    </Icon>
  )
}

export function AzureAnalyticsFamilyIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <path d="M5 17V11M10 17V7M15 17v-4M20 17V9" stroke={AZ} strokeWidth="2" strokeLinecap="round" />
    </Icon>
  )
}

export function AzureAiFamilyIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <circle cx="12" cy="12" r="3.2" fill={AZ} />
      <path d="M12 4v2.4M12 17.6V20M4 12h2.4M17.6 12H20M6.4 6.4l1.7 1.7M15.9 15.9l1.7 1.7M17.6 6.4l-1.7 1.7M6.4 17.6l1.7-1.7" stroke={AZ} strokeWidth="1.4" strokeLinecap="round" />
    </Icon>
  )
}

export function AzureWebFamilyIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <circle cx="12" cy="12" r="8" stroke={AZ} strokeWidth="1.4" />
      <path d="M4 12h16M12 4c2.4 2.6 3.6 5.4 3.6 8s-1.2 5.4-3.6 8c-2.4-2.6-3.6-5.4-3.6-8S9.6 6.6 12 4z" stroke={AZ} strokeWidth="1.3" />
    </Icon>
  )
}

export function AzureManagementFamilyIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <circle cx="12" cy="12" r="3" stroke={AZ} strokeWidth="1.4" />
      <path d="M12 5v2M12 17v2M5 12h2M17 12h2M7.1 7.1l1.4 1.4M15.5 15.5l1.4 1.4M16.9 7.1l-1.4 1.4M7.1 16.9l1.4-1.4" stroke={AZ} strokeWidth="1.4" strokeLinecap="round" />
    </Icon>
  )
}

export function AzureDevopsFamilyIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <path d="M7 8c4-4 10-1.5 10 4s-6 8-10 4" stroke={AZ} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <path d="M17 16c-4 4-10 1.5-10-4s6-8 10-4" stroke={AZ} strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </Icon>
  )
}

export function AzureIotFamilyIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <rect x="8" y="9" width="8" height="8" rx="1.4" stroke={AZ} strokeWidth="1.4" />
      <circle cx="12" cy="13" r="1.3" fill={AZ} />
      <path d="M12 6.5a6 6 0 015 2.8M12 6.5a6 6 0 00-5 2.8M12 4.2a8.4 8.4 0 017.2 4M12 4.2a8.4 8.4 0 00-7.2 4" stroke={AZ} strokeWidth="1.3" strokeLinecap="round" />
    </Icon>
  )
}

export function AzureHybridFamilyIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <path d="M5 16V10l4-3 3 2 3-2 4 3v6H5z" stroke={AZ} strokeWidth="1.4" fill={AZ} fillOpacity="0.12" />
      <path d="M8 8.5a4.5 4.5 0 018 1.4c1.6 0 3 1.2 3 2.8" stroke={AZ} strokeWidth="1.3" fill="none" />
    </Icon>
  )
}

/** Power Platform product stencils — geometric marks, not official logos. */
export function PowerPlatformIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <circle cx="12" cy="7.2" r="4.2" fill="#742774" />
      <circle cx="16.8" cy="12" r="4.2" fill="#0066FF" />
      <circle cx="12" cy="16.8" r="4.2" fill="#F2C811" />
      <circle cx="7.2" cy="12" r="4.2" fill="#00BCF2" />
    </Icon>
  )
}

export function PowerAppsIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <rect x="4" y="5" width="16" height="14" rx="2.5" fill="#742774" />
      <polygon points="10,9 10,15 16.5,12" fill="#fff" />
    </Icon>
  )
}

export function PowerAppsCanvasIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <rect x="4" y="5" width="16" height="14" rx="2.5" fill="#742774" />
      <rect x="7" y="8" width="10" height="8" rx="1" fill="#fff" opacity="0.95" />
      <path d="M8.5 14l2-3 1.5 2 1.5-2.5 2 3.5" stroke="#742774" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Icon>
  )
}

export function PowerAppsModelIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <rect x="4" y="5" width="16" height="14" rx="2.5" fill="#5B2C6F" />
      <path d="M7 9h10M7 12h10M7 15h6" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
    </Icon>
  )
}

export function PowerAutomateIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <path
        d="M7.2 13.5a5 5 0 019.2-2.2"
        stroke="#0066FF"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M16.4 8.6l.4 3.2-3.1-.6" fill="#0066FF" />
      <path
        d="M16.8 10.5a5 5 0 01-9.2 2.2"
        stroke="#00BCF2"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M7.6 15.4l-.4-3.2 3.1.6" fill="#00BCF2" />
    </Icon>
  )
}

export function PowerAutomateDesktopIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <rect x="4" y="5" width="16" height="11" rx="1.5" stroke="#0066FF" strokeWidth="1.6" />
      <path d="M9 18h6M12 16v2" stroke="#0066FF" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8 10.5h3.5l-1.2 3h3.2" stroke="#0066FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </Icon>
  )
}

export function PowerBiIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <rect x="4.5" y="14" width="4" height="6" rx="0.8" fill="#F2C811" />
      <rect x="10" y="9.5" width="4" height="10.5" rx="0.8" fill="#F2C811" />
      <rect x="15.5" y="4.5" width="4" height="15.5" rx="0.8" fill="#E6B800" />
    </Icon>
  )
}

export function PowerPagesIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <circle cx="12" cy="12" r="8" stroke="#0EA5E9" strokeWidth="1.6" fill="#E0F2FE" />
      <ellipse cx="12" cy="12" rx="3.5" ry="8" stroke="#0EA5E9" strokeWidth="1.3" />
      <path d="M4.5 12h15" stroke="#0EA5E9" strokeWidth="1.3" />
    </Icon>
  )
}

export function DataverseIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <ellipse cx="12" cy="7" rx="7" ry="2.6" fill="#7DD3FC" stroke="#0284C7" strokeWidth="1.2" />
      <path d="M5 7v5c0 1.5 3.1 2.6 7 2.6s7-1.1 7-2.6V7" fill="#BAE6FD" stroke="#0284C7" strokeWidth="1.2" />
      <path d="M5 12v5c0 1.5 3.1 2.6 7 2.6s7-1.1 7-2.6v-5" fill="#7DD3FC" stroke="#0284C7" strokeWidth="1.2" />
    </Icon>
  )
}

export function CopilotStudioIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <path
        d="M5 7.5c0-1.4 1.2-2.5 2.6-2.5h8.8C17.8 5 19 6.1 19 7.5v6c0 1.4-1.2 2.5-2.6 2.5H10l-4 3v-3.2C4.8 15.4 5 14.6 5 13.5v-6z"
        fill="#5B2C6F"
      />
      <path d="M9 10.2l1.1 2.3 2.5.2-2 1.6.6 2.4L9 15.3l-2.2 1.4.6-2.4-2-1.6 2.5-.2L9 10.2z" fill="#FBBF24" />
    </Icon>
  )
}

export function AiBuilderIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" fill="#C43B8C" />
      <circle cx="7" cy="17" r="1.4" fill="#742774" />
      <circle cx="12" cy="19" r="1.4" fill="#742774" />
      <circle cx="17" cy="17" r="1.4" fill="#742774" />
      <path d="M11.2 14.6L7.8 16.2M12.8 14.8l3.4 1.4" stroke="#742774" strokeWidth="1.2" />
    </Icon>
  )
}

export function PowerConnectorIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <rect x="3" y="9" width="7" height="6" rx="1.2" fill="#742774" />
      <rect x="14" y="9" width="7" height="6" rx="1.2" fill="#0066FF" />
      <path d="M10 12h4" stroke="#64748b" strokeWidth="2" strokeLinecap="round" />
      <path d="M5 9V7.5M8 9V7.5M16 15v1.5M19 15v1.5" stroke="#742774" strokeWidth="1.4" strokeLinecap="round" />
    </Icon>
  )
}

export function DataGatewayIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <path d="M6 14h12v5H6z" fill="#5B2C6F" />
      <path d="M8 14V11h8v3" stroke="#5B2C6F" strokeWidth="1.5" fill="none" />
      <path d="M8 8.5a4 4 0 018 0" stroke="#00BCF2" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <circle cx="12" cy="16.5" r="1.1" fill="#fff" />
    </Icon>
  )
}

export function Microsoft365Icon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <rect x="4" y="4" width="7" height="7" rx="1" fill="#F25022" />
      <rect x="13" y="4" width="7" height="7" rx="1" fill="#7FBA00" />
      <rect x="4" y="13" width="7" height="7" rx="1" fill="#00A4EF" />
      <rect x="13" y="13" width="7" height="7" rx="1" fill="#FFB900" />
    </Icon>
  )
}

export function SharePointIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <circle cx="9" cy="12" r="5.2" fill="#038387" />
      <circle cx="15.5" cy="9" r="3.6" fill="#4DB6AC" />
      <circle cx="15" cy="16" r="2.8" fill="#80CBC4" />
    </Icon>
  )
}

export function OneDriveIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <path d="M8 16a5 5 0 01.6-9.6 5.5 5.5 0 0110.2 2.2A4.2 4.2 0 0118 16H8z" fill="#0078D4" />
      <path d="M7.2 16A4.2 4.2 0 016 8.2 4.6 4.6 0 0114.4 9" fill="#28A8EA" opacity="0.95" />
    </Icon>
  )
}

export function TeamsIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <rect x="6" y="7" width="11" height="11" rx="2.2" fill="#6264A7" />
      <circle cx="11.5" cy="11" r="2" fill="#fff" />
      <path d="M8 16c0-1.6 1.6-2.6 3.5-2.6S15 14.4 15 16" stroke="#fff" strokeWidth="1.3" fill="none" />
      <circle cx="16.5" cy="7.5" r="2.2" fill="#7B83EB" />
    </Icon>
  )
}

export function OutlookIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <rect x="5" y="6" width="15" height="12" rx="1.5" fill="#0078D4" />
      <path d="M5 8l7.5 5.2L20 8" stroke="#fff" strokeWidth="1.5" fill="none" />
      <rect x="3" y="8" width="8" height="9" rx="1" fill="#28A8EA" />
      <text x="7" y="14.5" textAnchor="middle" fill="#fff" fontSize="7" fontWeight="700">
        O
      </text>
    </Icon>
  )
}

export function ExchangeIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <rect x="4" y="6" width="16" height="12" rx="1.6" fill="#0078D4" />
      <path d="M4 8.2l8 5.4 8-5.4" stroke="#fff" strokeWidth="1.5" fill="none" />
      <path d="M7 15h10" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" />
    </Icon>
  )
}

export function WordIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <rect x="5" y="4" width="14" height="16" rx="1.6" fill="#2B579A" />
      <path d="M8 8l2 8 2-5.5 2 5.5 2-8" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
    </Icon>
  )
}

export function ExcelIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <rect x="5" y="4" width="14" height="16" rx="1.6" fill="#217346" />
      <path d="M9 8l6 8M15 8l-6 8" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
    </Icon>
  )
}

export function PowerPointIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <rect x="5" y="4" width="14" height="16" rx="1.6" fill="#D24726" />
      <path d="M9 8h4.2a2.6 2.6 0 010 5.2H9V8z" stroke="#fff" strokeWidth="1.5" fill="none" />
    </Icon>
  )
}

export function OneNoteIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <rect x="5" y="4" width="14" height="16" rx="1.6" fill="#7719AA" />
      <path d="M9 7v10M9 7h5.5a2.4 2.4 0 010 4.8H9" stroke="#fff" strokeWidth="1.6" fill="none" />
    </Icon>
  )
}

export function GraphIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <circle cx="6" cy="12" r="2.2" fill="#5B2C6F" />
      <circle cx="18" cy="7" r="2.2" fill="#7C3AED" />
      <circle cx="18" cy="17" r="2.2" fill="#7C3AED" />
      <circle cx="12" cy="12" r="2.4" fill="#0078D4" />
      <path d="M8 12h2M14 10.6l2.4-2.2M14 13.4l2.4 2.2" stroke="#5B2C6F" strokeWidth="1.4" />
    </Icon>
  )
}

export function IntuneIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <rect x="7" y="4" width="10" height="16" rx="1.6" fill="#0078D4" />
      <rect x="9" y="7" width="6" height="8" rx="0.8" fill="#fff" />
      <circle cx="12" cy="17.2" r="0.8" fill="#fff" />
    </Icon>
  )
}

export function LoopIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <path d="M8 9c3.2-3 8.5-1.2 8.5 3.2 0 3.6-3.6 5.4-6.6 4.2" stroke="#0078D4" strokeWidth="2" fill="none" />
      <path d="M16 15c-3.2 3-8.5 1.2-8.5-3.2 0-3.6 3.6-5.4 6.6-4.2" stroke="#28A8EA" strokeWidth="2" fill="none" />
    </Icon>
  )
}

export function ListsIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2" fill="#D83B01" />
      <path d="M8 9h8M8 12h8M8 15h5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
    </Icon>
  )
}

export function PlannerIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <rect x="4" y="5" width="16" height="14" rx="1.6" fill="#31752F" />
      <rect x="6.2" y="8" width="3.2" height="8" rx="0.6" fill="#fff" />
      <rect x="10.4" y="10" width="3.2" height="6" rx="0.6" fill="#C8E6C9" />
      <rect x="14.6" y="7" width="3.2" height="9" rx="0.6" fill="#fff" />
    </Icon>
  )
}

export function StreamIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <rect x="4" y="5" width="16" height="14" rx="2" fill="#BC1948" />
      <polygon points="10,9 10,15 16,12" fill="#fff" />
    </Icon>
  )
}

export function WhiteboardIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <rect x="4" y="5" width="16" height="14" rx="1.6" fill="#fff" stroke="#D83B01" strokeWidth="1.6" />
      <path d="M7 15c2-4 4-4 6 0 1.2-2 2.4-2 4 0" stroke="#D83B01" strokeWidth="1.4" fill="none" />
    </Icon>
  )
}

export function FormsIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <rect x="5" y="4" width="14" height="16" rx="1.6" fill="#0078D4" />
      <path d="M8 8h8M8 12h8M8 16h5" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="8" cy="8" r="0.7" fill="#fff" />
    </Icon>
  )
}

export function BookingsIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <rect x="4" y="6" width="16" height="14" rx="1.6" fill="#0078D4" />
      <path d="M8 4v4M16 4v4M4 10h16" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
      <rect x="8" y="12.5" width="3" height="3" rx="0.4" fill="#fff" />
    </Icon>
  )
}

export function VivaIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <path d="M12 19s-6.5-4.1-6.5-8.2A3.6 3.6 0 0112 8a3.6 3.6 0 016.5 2.8C18.5 14.9 12 19 12 19z" fill="#C43B8C" />
    </Icon>
  )
}

export function EdgeIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <circle cx="12" cy="12" r="8" fill="#0078D4" />
      <path d="M5 13.5c2.4 3.4 8.4 4.6 12.2 1.2-3.2 3.6-9.6 2.4-12.2-1.2z" fill="#28A8EA" />
      <ellipse cx="13" cy="11" rx="4.2" ry="3.2" fill="#fff" />
    </Icon>
  )
}

export function Windows365Icon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <path d="M4 6l7-.8v6.2H4V6zM12.2 5l7.8-1v7.4h-7.8V5zM4 13.2h7v6.2l-7-.8v-5.4zM12.2 13.2H20V20l-7.8-.9v-5.9z" fill="#0078D4" />
    </Icon>
  )
}

export function ToDoIcon({ size = 20, ...props }: IconProps) {
  return (
    <Icon size={size} {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2" fill="#5B2C6F" />
      <path d="M7.5 12.2l2.4 2.4 6.2-6.6" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" />
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
  'Azure DevOps': AzureDevOpsIcon,
}

const AZURE_FAMILY_ICONS: Record<AzureIconFamily, (props: IconProps) => ReactNode> = {
  compute: AzureComputeFamilyIcon,
  containers: AzureContainersFamilyIcon,
  networking: AzureNetworkingFamilyIcon,
  storage: AzureStorageFamilyIcon,
  databases: AzureSqlIcon,
  integration: AzureIntegrationFamilyIcon,
  identity: AzureIdentityFamilyIcon,
  security: AzureSecurityFamilyIcon,
  analytics: AzureAnalyticsFamilyIcon,
  ai: AzureAiFamilyIcon,
  web: AzureWebFamilyIcon,
  management: AzureManagementFamilyIcon,
  devops: AzureDevopsFamilyIcon,
  iot: AzureIotFamilyIcon,
  hybrid: AzureHybridFamilyIcon,
  generic: AzureGenericIcon,
}

const MICROSOFT_ICON_MAP: Record<string, (props: IconProps) => ReactNode> = {
  'Microsoft 365': Microsoft365Icon,
  'Microsoft 365 Copilot': CopilotStudioIcon,
  SharePoint: SharePointIcon,
  'SharePoint Hub Site': SharePointIcon,
  'SharePoint Site': SharePointIcon,
  'SharePoint Library': SharePointIcon,
  'SharePoint List': ListsIcon,
  'SharePoint Server': SharePointIcon,
  OneDrive: OneDriveIcon,
  'OneDrive for Business': OneDriveIcon,
  'Microsoft Teams': TeamsIcon,
  'Teams Channel': TeamsIcon,
  'Teams Phone': TeamsIcon,
  Outlook: OutlookIcon,
  'Exchange Online': ExchangeIcon,
  'Exchange Server': ExchangeIcon,
  'Microsoft Graph': GraphIcon,
  'Microsoft Loop': LoopIcon,
  'Microsoft Lists': ListsIcon,
  'Microsoft Stream': StreamIcon,
  'Microsoft Viva': VivaIcon,
  'Viva Engage': VivaIcon,
  'Microsoft Bookings': BookingsIcon,
  'Windows 365': Windows365Icon,
  Word: WordIcon,
  Excel: ExcelIcon,
  PowerPoint: PowerPointIcon,
  OneNote: OneNoteIcon,
  'Microsoft Planner': PlannerIcon,
  'Microsoft To Do': ToDoIcon,
  'Microsoft Forms': FormsIcon,
  'Microsoft Whiteboard': WhiteboardIcon,
  'Microsoft Edge': EdgeIcon,
  'Microsoft Clipchamp': StreamIcon,
  'Entra ID': AzureEntraIcon,
  'Microsoft Intune': IntuneIcon,
  'Microsoft Defender': AzureSecurityFamilyIcon,
  'Microsoft Purview': AzureSecurityFamilyIcon,
  'Microsoft Fabric': AzureAnalyticsFamilyIcon,
}

const POWER_PLATFORM_ICON_MAP: Record<string, (props: IconProps) => ReactNode> = {
  'Power Automate Desktop': PowerAutomateDesktopIcon,
  'Model-driven App': PowerAppsModelIcon,
  'Custom Connector': PowerConnectorIcon,
  'Canvas App': PowerAppsCanvasIcon,
  'Copilot Studio': CopilotStudioIcon,
  'Power Automate': PowerAutomateIcon,
  'Power Platform': PowerPlatformIcon,
  'Power Apps': PowerAppsIcon,
  'Power Pages': PowerPagesIcon,
  'Data Gateway': DataGatewayIcon,
  'AI Builder': AiBuilderIcon,
  Dataverse: DataverseIcon,
  'Power BI': PowerBiIcon,
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

  const powerIcon = POWER_PLATFORM_ICON_MAP[service]
  if (powerIcon) return powerIcon({ size })

  const microsoftIcon = MICROSOFT_ICON_MAP[service]
  if (microsoftIcon) return microsoftIcon({ size })

  if (vendor === 'AWS' || vendor?.includes('AWS')) {
    const IconComponent = AWS_ICON_MAP[service]
    if (IconComponent) return <IconComponent size={size} />
  }

  if (vendor?.includes('Azure')) {
    const IconComponent = AZURE_ICON_MAP[service]
    if (IconComponent) return <IconComponent size={size} />
    const family = AZURE_SERVICE_FAMILY[service]
    const FamilyIcon = family ? AZURE_FAMILY_ICONS[family] : AzureGenericIcon
    return <FamilyIcon size={size} />
  }

  if (vendor?.includes('Microsoft 365') || vendor === 'Microsoft') {
    return <Microsoft365Icon size={size} />
  }

  if (vendor?.includes('Atlassian') || service === 'Jira') {
    return <JiraIcon size={size} />
  }

  return null
}

export function getServiceIconFromLabel(label: string, systemType: string, size = 22): ReactNode | null {
  const awsMatch = AWS_ICON_MAP[label.replace('Amazon ', '').replace('AWS ', '')]
  if (systemType === 'aws') {
    for (const [key, Icon] of Object.entries(AWS_ICON_MAP)) {
      if (label.includes(key)) return <Icon size={size} />
    }
  }
  if (systemType === 'azure') {
    for (const [key, Icon] of Object.entries(AZURE_ICON_MAP)) {
      if (label.includes(key) || label.includes(key.replace('Azure ', ''))) return <Icon size={size} />
    }
    return <AzureGenericIcon size={size} />
  }
  const microsoftMatch = matchIconByLabel(label, MICROSOFT_ICON_MAP)
  if (microsoftMatch) return microsoftMatch({ size })
  const powerMatch = matchIconByLabel(label, POWER_PLATFORM_ICON_MAP)
  if (powerMatch) return powerMatch({ size })
  if (systemType === 'powerplatform') return <PowerPlatformIcon size={size} />
  if (awsMatch) return awsMatch({ size })
  if (label.toLowerCase().includes('jira')) return <JiraIcon size={size} />
  if (label.toLowerCase().includes('azure devops') || label.toLowerCase().includes('ado')) {
    return <AzureDevOpsIcon size={size} />
  }
  if (label.toLowerCase().includes('power virtual')) return <CopilotStudioIcon size={size} />
  return null
}

function matchIconByLabel(
  label: string,
  map: Record<string, (props: IconProps) => ReactNode>,
): ((props: IconProps) => ReactNode) | null {
  const lower = label.toLowerCase()
  const keys = Object.keys(map).sort((a, b) => b.length - a.length)
  for (const key of keys) {
    if (lower.includes(key.toLowerCase())) return map[key]
  }
  return null
}