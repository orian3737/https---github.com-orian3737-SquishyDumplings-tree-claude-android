package com.dumplings.pet.model

/**
 * Rarity tiers pulled at unboxing. [dropWeight] values are relative weights,
 * not percentages — they get normalized in [Rarity.rollRandom]. Change these
 * numbers to retune odds; the disclosed-odds screen (required by Apple/Google
 * loot box policy) should read directly from [dropPercentLabel] so the UI and
 * the actual roll can never drift out of sync.
 */
enum class Rarity(
    val displayName: String,
    val dropWeight: Double,
    val colorHex: Long,
    val maxEvolutionStage: Int
) {
    COMMON(displayName = "Common", dropWeight = 60.0, colorHex = 0xFF9E9E9E, maxEvolutionStage = 2),
    UNCOMMON(displayName = "Uncommon", dropWeight = 25.0, colorHex = 0xFF4CAF50, maxEvolutionStage = 2),
    RARE(displayName = "Rare", dropWeight = 10.0, colorHex = 0xFF2196F3, maxEvolutionStage = 3),
    EPIC(displayName = "Epic", dropWeight = 4.0, colorHex = 0xFF9C27B0, maxEvolutionStage = 3),
    LEGENDARY(displayName = "Legendary", dropWeight = 1.0, colorHex = 0xFFFFC107, maxEvolutionStage = 4);

    companion object {
        private val totalWeight = entries.sumOf { it.dropWeight }

        /** Human-readable odds for the mandatory disclosure screen, e.g. "10.0%" */
        fun Rarity.dropPercentLabel(): String {
            val pct = (dropWeight / totalWeight) * 100.0
            return String.format("%.1f%%", pct)
        }

        /** Rolls a single rarity according to the weights above. */
        fun rollRandom(): Rarity {
            val roll = Math.random() * totalWeight
            var cumulative = 0.0
            for (rarity in entries) {
                cumulative += rarity.dropWeight
                if (roll <= cumulative) return rarity
            }
            return COMMON // fallback, should be unreachable
        }
    }
}
