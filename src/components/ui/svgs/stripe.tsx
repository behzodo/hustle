import type { SVGProps } from 'react'

// Stripe's "S" mark on its brand purple.
export const Stripe = (props: SVGProps<SVGSVGElement>) => (
    <svg
        {...props}
        viewBox="0 0 32 32"
        xmlns="http://www.w3.org/2000/svg"
    >
        <rect
            width="32"
            height="32"
            rx="6"
            fill="#635BFF"
        />
        <path
            fill="#fff"
            d="M15.05 12.9c0-.72.6-1 1.57-1a10.3 10.3 0 0 1 4.58 1.19V8.75a12.18 12.18 0 0 0-4.58-.85c-3.74 0-6.23 1.96-6.23 5.22 0 5.1 7 4.28 7 6.48 0 .85-.74 1.13-1.77 1.13-1.4 0-3.2-.58-4.62-1.36v4.4a11.72 11.72 0 0 0 4.62.97c3.83 0 6.47-1.9 6.47-5.2 0-5.5-7.04-4.52-7.04-6.64Z"
        />
    </svg>
)
