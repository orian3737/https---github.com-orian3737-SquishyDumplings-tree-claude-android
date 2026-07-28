package com.dumplings.pet.model

/**
 * Core Tamagotchi-style needs. All values are 0-100.
 * Feed/clean/play actions push a stat up; [decayed] pulls stats down over time.
 */
data class PetStats(
    val hunger: Int = 80,
    val cleanliness: Int = 80,
    val energy: Int = 80,
    val happiness: Int = 80
) {
    private fun Int.clamp() = coerceIn(0, 100)

    fun feed(amount: Int = 25): PetStats = copy(hunger = (hunger + amount).clamp())
    fun clean(amount: Int = 35): PetStats = copy(cleanliness = (cleanliness + amount).clamp())
    fun play(amount: Int = 20): PetStats = copy(
        happiness = (happiness + amount).clamp(),
        energy = (energy - (amount / 2)).clamp()
    )
    fun rest(amount: Int = 30): PetStats = copy(energy = (energy + amount).clamp())

    /**
     * Call periodically (e.g. every real-world minute via a WorkManager job or
     * the overlay service's ticker) to simulate neglect over time.
     */
    fun decayed(minutesElapsed: Int): PetStats {
        val hungerLoss = minutesElapsed * 1
        val cleanLoss = minutesElapsed * 1
        val energyLoss = minutesElapsed / 2
        val happinessLoss = minutesElapsed / 2
        return copy(
            hunger = (hunger - hungerLoss).clamp(),
            cleanliness = (cleanliness - cleanLoss).clamp(),
            energy = (energy - energyLoss).clamp(),
            happiness = (happiness - happinessLoss).clamp()
        )
    }

    /** Overall wellbeing used to bias which idle behaviors the pet favors. */
    val overallMood: Int
        get() = (hunger + cleanliness + energy + happiness) / 4

    val isNeglected: Boolean
        get() = hunger < 20 || cleanliness < 20
}
