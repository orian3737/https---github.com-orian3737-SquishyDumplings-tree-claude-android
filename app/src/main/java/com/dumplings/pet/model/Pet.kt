package com.dumplings.pet.model

import java.util.UUID

/** Personality tags earned from how the owner treats the pet — drives branching evolution and AI chat tone. */
enum class PersonalityTag {
    SPICY, GENTLE, GRUMPY, PLAYFUL, SLEEPY, CHATTY
}

data class Pet(
    val id: String = UUID.randomUUID().toString(),
    val name: String,
    val rarity: Rarity,
    val evolutionStage: Int = 0,
    val stats: PetStats = PetStats(),
    val personalityTags: Set<PersonalityTag> = emptySet(),
    val bornAtMillis: Long = System.currentTimeMillis()
) {
    val canEvolve: Boolean
        get() = evolutionStage < rarity.maxEvolutionStage && stats.overallMood >= 70

    fun evolved(): Pet =
        if (canEvolve) copy(evolutionStage = evolutionStage + 1) else this

    companion object {
        /** Convenience factory for the unboxing flow: rolls rarity, hands back a fresh pet. */
        fun unboxNew(name: String): Pet = Pet(name = name, rarity = Rarity.rollRandom())
    }
}
