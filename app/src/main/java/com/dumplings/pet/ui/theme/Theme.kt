package com.dumplings.pet.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val DumplingColorScheme = lightColorScheme(
    primary = DumplingAmber,
    secondary = DumplingGreenLawn,
    background = DumplingCream,
    surface = DumplingCream
)

@Composable
fun SquishyDumplingsTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DumplingColorScheme,
        content = content
    )
}
