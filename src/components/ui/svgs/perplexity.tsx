import type { SVGProps } from 'react'

export const Perplexity = (props: SVGProps<SVGSVGElement>) => (
    <svg
        {...props}
        preserveAspectRatio="xMidYMid"
        viewBox="0 0 256 256"
    >
        <path
            fill="currentColor"
            d="M128 21.333 47.36 88.107h30.187v79.04h-30.4v67.52l80.64-66.987v67.627h20.907v-67.627l80.64 66.987v-67.52h-30.4v-79.04h30.187L128 21.333Zm-10.453 46.72v41.28L82.24 79.573l35.307-31.52Zm20.906 0 35.307 31.52-35.307 29.76v-41.28ZM98.453 88.107h20.907l-.107 79.04H98.453v-79.04Zm38.187 0h20.907v79.04H136.64v-79.04Zm-70.187 96.746 30.4-25.28v50.454l-30.4 25.28v-50.454Zm123.094 0v50.454l-30.4-25.28V159.573l30.4 25.28Z"
        />
    </svg>
)
