package com.dumplings.pet.overlay

import com.dumplings.pet.model.PetStats

/** A single ambient action the pet can perform while floating in overlay mode. */
enum class Behavior(val durationMillis: Long, val baseWeight: Double) {
    IDLE_SIT(2500, 3.0),
    STRETCH(1800, 1.5),
    LOOK_AROUND(2000, 2.0),
    YAWN(1500, 1.0),
    NAP(6000, 1.5),
    WADDLE_LEFT(2200, 2.5),
    WADDLE_RIGHT(2200, 2.5),
    PACE(3500, 2.0),
    SPRINT(1200, 0.8),
    PEEK_OVER_EDGE(1800, 1.2),
    HOP_TRICK(1000, 0.4),
    WOBBLE(900, 0.6)
}

/**
 * Behaviors that should never immediately follow the given behavior — avoids
 * jarring transitions like sprinting straight out of a nap. Anything not
 * listed here has no restriction.
 */
private val invalidNextBehaviors: Map<Behavior, Set<Behavior>> = mapOf(
    Behavior.NAP to setOf(Behavior.SPRINT, Behavior.HOP_TRICK, Behavior.WADDLE_LEFT, Behavior.WADDLE_RIGHT),
    Behavior.YAWN to setOf(Behavior.SPRINT, Behavior.HOP_TRICK)
)

/**
 * Picks the next ambient behavior. Weighted random + no-immediate-repeat +
 * stat-biasing, so the same 12-behavior pool reads as "alive" rather than
 * a visible loop even after long observation.
 */
class BehaviorPicker {
    private var lastBehavior: Behavior? = null

    fun pickNext(stats: PetStats): Behavior {
        val forbidden = lastBehavior?.let { invalidNextBehaviors[it] } ?: emptySet()
        val candidates = Behavior.entries.filter { it != lastBehavior && it !in forbidden }

        val weighted = candidates.associateWith { biasedWeight(it, stats) }
        val totalWeight = weighted.values.sum()
        var roll = Math.random() * totalWeight

        for ((behavior, weight) in weighted) {
            roll -= weight
            if (roll <= 0) {
                lastBehavior = behavior
                return behavior
            }
        }

        val fallback = candidates.first()
        lastBehavior = fallback
        return fallback
    }

    /** Low energy/hunger nudges toward sluggish behaviors; high happiness nudges toward playful ones. */
    private fun biasedWeight(behavior: Behavior, stats: PetStats): Double {
        var weight = behavior.baseWeight

        val isSluggish = behavior in setOf(Behavior.NAP, Behavior.YAWN, Behavior.IDLE_SIT)
        val isPlayful = behavior in setOf(Behavior.HOP_TRICK, Behavior.SPRINT, Behavior.WOBBLE)

        if (stats.energy < 35 && isSluggish) weight *= 2.5
        if (stats.energy < 35 && isPlayful) weight *= 0.3

        if (stats.happiness > 75 && isPlayful) weight *= 2.0
        if (stats.hunger < 25) weight *= if (behavior == Behavior.IDLE_SIT) 1.8 else 0.7

        return weight
    }
}
