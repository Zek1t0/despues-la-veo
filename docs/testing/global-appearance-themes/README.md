# Global appearance themes — Section 1

Run the pure theme-domain, 2×6 catalog, source-inventory, selection-contract, Light relative-luminance and Dark + Original parity harness with:

```powershell
node docs/testing/global-appearance-themes/section-1-verification.cjs
```

`type-contract.ts` is compile-only and is checked by the repository's regular `npx.cmd tsc --noEmit` command. Its expected TypeScript errors prove both an incomplete `ThemeDefinition` and a definition missing only `selectedForeground` are rejected.

The inventory deliberately records existing literals that the minimal contract does not map one-to-one yet (`#303030`, Title Detail's `#5a2a2a` error text, the intermediate `0.82` badge scrim and the `0.94` tag-label scrim). It separately anchors real danger/error, disabled and danger-surface foreground consumers so matching hex values in PersonalRating cannot stand in for semantic parity. They remain review gates for later consumer migrations; Section 1 does not change those consumers.

The Light gate uses sRGB-linearized relative luminance. All four base surfaces must have luminance `>= 0.50`, `textPrimary` must be darker than `background`, and that pair must reach `4.5:1`. This is an early invariant, not the complete Section 12 contrast audit.
