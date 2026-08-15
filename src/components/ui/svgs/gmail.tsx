import type { SVGProps } from 'react'

// Official Gmail mark. Keeps its own colours — brand logos should not be
// tinted to the product palette.
export const Gmail = (props: SVGProps<SVGSVGElement>) => (
    <svg
        {...props}
        viewBox="0 0 48 48"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            fill="#4285F4"
            d="M6 38h5V25.5L4 20v15a3 3 0 0 0 3 3Z"
        />
        <path
            fill="#34A853"
            d="M37 38h5a3 3 0 0 0 3-3V20l-8 5.5V38Z"
        />
        <path
            fill="#FBBC05"
            d="M37 12v13.5l8-5.5v-6.5c0-3.71-4.24-5.83-7.2-3.6L37 12Z"
        />
        <path
            fill="#EA4335"
            d="M11 25.5V12l13 9.75L37 12v13.5L24 35.25 11 25.5Z"
        />
        <path
            fill="#C5221F"
            d="M4 13.5V20l7 5.5V12l-.8-.6C7.24 9.17 3 11.29 3 15v-1.5h1Z"
        />
    </svg>
)
