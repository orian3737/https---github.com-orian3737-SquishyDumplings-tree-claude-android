package com.dumplings.pet.overlay

import androidx.annotation.DrawableRes
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import com.dumplings.pet.R

enum class DumplingExpression {
    IDLE,
    HAPPY,
    SLEEPY,
    HOP
}

@Composable
fun DumplingSprite(
    expression: DumplingExpression,
    modifier: Modifier = Modifier
) {
    Image(
        painter = painterResource(id = expression.drawableRes),
        contentDescription = expression.contentDescription,
        modifier = modifier.fillMaxSize(),
        contentScale = ContentScale.Fit
    )
}

private val DumplingExpression.contentDescription: String
    get() = when (this) {
        DumplingExpression.IDLE -> "Idle dumpling"
        DumplingExpression.HAPPY -> "Happy dumpling"
        DumplingExpression.SLEEPY -> "Sleepy dumpling"
        DumplingExpression.HOP -> "Hopping dumpling"
    }

@get:DrawableRes
private val DumplingExpression.drawableRes: Int
    get() = when (this) {
        DumplingExpression.IDLE -> R.drawable.dumpling_idle
        DumplingExpression.HAPPY -> R.drawable.dumpling_happy
        DumplingExpression.SLEEPY -> R.drawable.dumpling_sleepy
        DumplingExpression.HOP -> R.drawable.dumpling_hop
    }
