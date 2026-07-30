package com.dumplings.pet.data

import android.content.Context
import com.dumplings.pet.model.PersonalityTag
import com.dumplings.pet.model.Pet
import com.dumplings.pet.model.PetStats
import com.dumplings.pet.model.Rarity
import com.posthog.PostHog

class PetStore(context: Context) {
    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun loadOrCreate(defaultName: String): Pet {
        val id = prefs.getString(KEY_ID, null)
        if (id == null) {
            val newPet = Pet.unboxNew(defaultName)
            PostHog.identify(distinctId = newPet.id)
            PostHog.capture(
                event = "pet_created",
                properties = mapOf(
                    "pet_name" to newPet.name,
                    "rarity" to newPet.rarity.name.lowercase(),
                    "evolution_stage" to newPet.evolutionStage
                ),
                userPropertiesSetOnce = mapOf(
                    "pet_rarity" to newPet.rarity.name.lowercase(),
                    "pet_name" to newPet.name
                )
            )
            return newPet
        }
        val name = prefs.getString(KEY_NAME, defaultName) ?: defaultName
        val rarity = prefs.getString(KEY_RARITY, null)?.let(::rarityOrNull) ?: Rarity.COMMON
        val personalityTags = prefs.getStringSet(KEY_PERSONALITY_TAGS, emptySet()).orEmpty()
            .mapNotNull(::personalityTagOrNull)
            .toSet()

        val existingPet = Pet(
            id = id,
            name = name,
            rarity = rarity,
            evolutionStage = prefs.getInt(KEY_EVOLUTION_STAGE, 0),
            stats = PetStats(
                hunger = prefs.getInt(KEY_HUNGER, 80),
                cleanliness = prefs.getInt(KEY_CLEANLINESS, 80),
                energy = prefs.getInt(KEY_ENERGY, 80),
                happiness = prefs.getInt(KEY_HAPPINESS, 80)
            ),
            personalityTags = personalityTags,
            bornAtMillis = prefs.getLong(KEY_BORN_AT_MILLIS, System.currentTimeMillis())
        )
        PostHog.identify(distinctId = existingPet.id)
        return existingPet
    }

    fun save(pet: Pet) {
        prefs.edit()
            .putString(KEY_ID, pet.id)
            .putString(KEY_NAME, pet.name)
            .putString(KEY_RARITY, pet.rarity.name)
            .putInt(KEY_EVOLUTION_STAGE, pet.evolutionStage)
            .putInt(KEY_HUNGER, pet.stats.hunger)
            .putInt(KEY_CLEANLINESS, pet.stats.cleanliness)
            .putInt(KEY_ENERGY, pet.stats.energy)
            .putInt(KEY_HAPPINESS, pet.stats.happiness)
            .putStringSet(KEY_PERSONALITY_TAGS, pet.personalityTags.map { it.name }.toSet())
            .putLong(KEY_BORN_AT_MILLIS, pet.bornAtMillis)
            .apply()
    }

    private fun rarityOrNull(value: String): Rarity? =
        runCatching { Rarity.valueOf(value) }.getOrNull()

    private fun personalityTagOrNull(value: String): PersonalityTag? =
        runCatching { PersonalityTag.valueOf(value) }.getOrNull()

    private companion object {
        const val PREFS_NAME = "pet_state"
        const val KEY_ID = "id"
        const val KEY_NAME = "name"
        const val KEY_RARITY = "rarity"
        const val KEY_EVOLUTION_STAGE = "evolution_stage"
        const val KEY_HUNGER = "hunger"
        const val KEY_CLEANLINESS = "cleanliness"
        const val KEY_ENERGY = "energy"
        const val KEY_HAPPINESS = "happiness"
        const val KEY_PERSONALITY_TAGS = "personality_tags"
        const val KEY_BORN_AT_MILLIS = "born_at_millis"
    }
}
