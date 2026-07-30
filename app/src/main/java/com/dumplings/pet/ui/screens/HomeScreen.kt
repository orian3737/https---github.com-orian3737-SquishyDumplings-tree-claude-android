package com.dumplings.pet.ui.screens

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.dumplings.pet.data.PetStore
import com.dumplings.pet.overlay.OverlayService
import com.posthog.PostHog

/**
 * Full-interaction mode: where feed/clean/play actually happen. The
 * PiP-style "half screen habitat" layout we discussed is the natural next
 * step here - this version keeps it a single full screen to get you running
 * today; swap the Column below for the habitat layout when you're ready.
 */
@Composable
fun HomeScreen() {
    val context = LocalContext.current
    val petStore = remember { PetStore(context.applicationContext) }
    var pet by remember { mutableStateOf(petStore.loadOrCreate(defaultName = "Baozi")) }
    var ambientActive by remember { mutableStateOf(false) }

    LaunchedEffect(pet) {
        petStore.save(pet)
    }

    fun startOverlay() {
        ContextCompat.startForegroundService(context, Intent(context, OverlayService::class.java))
        ambientActive = true
        PostHog.capture(
            event = "overlay_started",
            properties = mapOf(
                "rarity" to pet.rarity.name.lowercase(),
                "evolution_stage" to pet.evolutionStage
            )
        )
    }

    val notificationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted || Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            startOverlay()
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = "${pet.name} the ${pet.rarity.displayName} Dumpling",
            style = MaterialTheme.typography.headlineSmall
        )
        Text(
            text = "Evolution stage ${pet.evolutionStage} / ${pet.rarity.maxEvolutionStage}",
            style = MaterialTheme.typography.bodySmall
        )

        Spacer(modifier = Modifier.height(24.dp))

        StatRow("Hunger", pet.stats.hunger)
        StatRow("Cleanliness", pet.stats.cleanliness)
        StatRow("Energy", pet.stats.energy)
        StatRow("Happiness", pet.stats.happiness)

        Spacer(modifier = Modifier.height(24.dp))

        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Button(onClick = {
                val newPet = pet.copy(stats = pet.stats.feed())
                pet = newPet
                PostHog.capture(
                    event = "pet_fed",
                    properties = mapOf(
                        "hunger_after" to newPet.stats.hunger,
                        "rarity" to newPet.rarity.name.lowercase(),
                        "evolution_stage" to newPet.evolutionStage
                    )
                )
            }) {
                Text("Feed")
            }
            Button(onClick = {
                val newPet = pet.copy(stats = pet.stats.clean())
                pet = newPet
                PostHog.capture(
                    event = "pet_cleaned",
                    properties = mapOf(
                        "cleanliness_after" to newPet.stats.cleanliness,
                        "rarity" to newPet.rarity.name.lowercase(),
                        "evolution_stage" to newPet.evolutionStage
                    )
                )
            }) {
                Text("Clean")
            }
            Button(onClick = {
                val newPet = pet.copy(stats = pet.stats.play())
                pet = newPet
                PostHog.capture(
                    event = "pet_played_with",
                    properties = mapOf(
                        "happiness_after" to newPet.stats.happiness,
                        "energy_after" to newPet.stats.energy,
                        "rarity" to newPet.rarity.name.lowercase(),
                        "evolution_stage" to newPet.evolutionStage
                    )
                )
            }) {
                Text("Play")
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        if (pet.canEvolve) {
            Button(onClick = {
                val newPet = pet.evolved()
                pet = newPet
                PostHog.capture(
                    event = "pet_evolved",
                    properties = mapOf(
                        "evolution_stage" to newPet.evolutionStage,
                        "rarity" to newPet.rarity.name.lowercase(),
                        "max_evolution_stage" to newPet.rarity.maxEvolutionStage
                    )
                )
            }) {
                Text("Evolve!")
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        Card(modifier = Modifier.fillMaxWidth().padding(top = 12.dp)) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("Ambient companion mode", style = MaterialTheme.typography.titleSmall)
                Text(
                    "Let your dumpling float on your screen while you use other apps.",
                    style = MaterialTheme.typography.bodySmall
                )
                Spacer(modifier = Modifier.height(8.dp))
                Button(onClick = {
                    val intent = Intent(context, OverlayService::class.java)
                    if (ambientActive) {
                        context.stopService(intent)
                        ambientActive = false
                        PostHog.capture(
                            event = "overlay_stopped",
                            properties = mapOf(
                                "rarity" to pet.rarity.name.lowercase(),
                                "evolution_stage" to pet.evolutionStage
                            )
                        )
                    } else if (
                        Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                        ContextCompat.checkSelfPermission(
                            context,
                            Manifest.permission.POST_NOTIFICATIONS
                        ) != PackageManager.PERMISSION_GRANTED
                    ) {
                        notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                    } else {
                        startOverlay()
                    }
                }) {
                    Text(if (ambientActive) "Bring dumpling back inside" else "Let dumpling roam")
                }
            }
        }
    }
}

@Composable
private fun StatRow(label: String, value: Int) {
    Column(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Text("$label: $value", style = MaterialTheme.typography.bodyMedium)
        LinearProgressIndicator(
            progress = { value / 100f },
            modifier = Modifier.fillMaxWidth().height(6.dp)
        )
    }
}
