package org.bragi.nativeapp.ui

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.unit.dp

/** Small vector set: no icon font or large icon-pack dependency. */
enum class BragiIcon(private val path: String) {
    Music("M9,3v12.2A4,4 0,1 0,11 19V7h8V3z"),
    Artist("M12,12a4,4 0,1 0,0 -8,4,4 0,0 0,0 8M4,20v-1c0,-3.3 3.6,-5 8,-5s8,1.7 8,5v1z"),
    Album("M12,2a10,10 0,1 0,0 20,10,10 0,0 0,0 -20M12,8a4,4 0,1 1,0 8,4,4 0,0 1,0 -8M12,10a2,2 0,1 0,0 4,2,2 0,0 0,0 -4"),
    Playlist("M3,5h13v2H3zM3,10h13v2H3zM3,15h9v2H3zM18,13v5.2a2.8,2.8 0,1 1,-2 -2.68V13z"),
    Statistics("M4,13h3v7H4zM10.5,4h3v16h-3zM17,9h3v11h-3z"),
    Explore("M12,2a10,10 0,1 0,0 20,10,10 0,0 0,0 -20M15.8,8.2l-2.2,5.4 -5.4,2.2 2.2,-5.4z"),
    Play("M6,4.7c0,-1.3 1.4,-2.1 2.5,-1.4l11.4,7.3c1,.6 1,2.2 0,2.8L8.5,20.7C7.4,21.4 6,20.6 6,19.3z"),
    Pause("M8,4a2,2 0,0 1,2 2v12a2,2 0,0 1,-4 0V6a2,2 0,0 1,2 -2zM16,4a2,2 0,0 1,2 2v12a2,2 0,0 1,-4 0V6a2,2 0,0 1,2 -2z"),
    Previous("M5,5a1.5,1.5 0,0 1,3 0v14a1.5,1.5 0,0 1,-3 0zM19,5.2v13.6c0,1.2 -1.3,1.9 -2.3,1.3l-7.5,-6.8c-.8,-.7 -.8,-1.9 0,-2.6l7.5,-6.8c1,-.6 2.3,.1 2.3,1.3z"),
    Next("M16,5a1.5,1.5 0,0 1,3 0v14a1.5,1.5 0,0 1,-3 0zM5,5.2c0,-1.2 1.3,-1.9 2.3,-1.3l7.5,6.8c.8,.7 .8,1.9 0,2.6l-7.5,6.8C6.3,20.7 5,20 5,18.8z"),
    Edit("M3,17.25V21h3.75L17.81,9.94l-3.75,-3.75zM20.71,7.04a1,1 0,0 0,0 -1.41l-2.34,-2.34a1,1 0,0 0,-1.41 0L15.13,5.12l3.75,3.75z"),
    Save("M17,3H5a2,2 0,0 0,-2 2v14a2,2 0,0 0,2 2h14a2,2 0,0 0,2 -2V7zM12,19a3,3 0,1 1,0 -6,3,3 0,0 1,0 6M6,5h9v4H6z"),
    Delete("M6,19a2,2 0,0 0,2 2h8a2,2 0,0 0,2 -2V7H6zM19,4h-3.5l-1,-1h-5l-1,1H5v2h14z"),
    Search("M10,3a7,7 0,1 0,4.9 12l5,5 1.4,-1.4 -5,-5A7,7 0,0 0,10 3M10,5a5,5 0,1 1,0 10,5,5 0,0 1,0 -10"),
    Close("M6.4,5L12,10.6 17.6,5 19,6.4 13.4,12 19,17.6 17.6,19 12,13.4 6.4,19 5,17.6 10.6,12 5,6.4z"),
    Down("M5,8l7,7 7,-7 -1.4,-1.4L12,12.2 6.4,6.6z"),
    Refresh("M17.7,6.3A8,8 0,1 0,20 14h-2.1A6,6 0,1 1,16.3 7.7L13,11h8V3z"),
    Queue("M3,5h14v2H3zM3,10h14v2H3zM3,15h9v2H3zM16,14l6,4 -6,4z"),
    Shuffle("M3,5h3l12,12v-4h2v8h-8v-2h4L5,7H3zM13,3h7v7h-2V6l-5,5 -1.4,-1.4L16.2,5H13zM3,17h2l3,-3 1.4,1.4L6,19H3z"),
    Phone("M7,2h10a2,2 0,0 1,2 2v16a2,2 0,0 1,-2 2H7a2,2 0,0 1,-2 -2V4a2,2 0,0 1,2 -2M7,5v14h10V5z"),
    Warning("M12,2L1,21h22zM11,8h2v7h-2zM11,17h2v2h-2z"),
    Link("M3,3h8v2H5v14h14v-6h2v8H3zM13,3h8v8h-2V6.4l-8.3,8.3 -1.4,-1.4L17.6,5H13z"),
    Settings("M19.4,13a8,8 0,0 0,0 -2l2,-1.5 -2,-3.5 -2.4,1a8,8 0,0 0,-1.7 -1L15,3H9l-.3,3a8,8 0,0 0,-1.7 1l-2.4,-1 -2,3.5 2,1.5a8,8 0,0 0,0 2l-2,1.5 2,3.5 2.4,-1a8,8 0,0 0,1.7 1L9,21h6l.3,-3a8,8 0,0 0,1.7 -1l2.4,1 2,-3.5zM12,15a3,3 0,1 1,0 -6,3,3 0,0 1,0 6"),
    Menu("M3,6h18v2H3zM3,11h18v2H3zM3,16h18v2H3z"),
    Cast("M1,18v3h3a3,3 0,0 0,-3 -3M1,14v2a5,5 0,0 1,5 5h2a7,7 0,0 0,-7 -7M1,10v2a9,9 0,0 1,9 9h2A11,11 0,0 0,1 10M4,3h16a2,2 0,0 1,2 2v12a2,2 0,0 1,-2 2h-6v-2h6V5H4v3H2V5a2,2 0,0 1,2 -2"),
    Heart("M12,21s-9,-5.6 -9,-11.5C3,5 8,3 12,7c4,-4 9,-2 9,2.5C21,15.4 12,21 12,21z"),
    Recent("M6,3h2v2H6zM16,3h2v2h-2zM5,5h14a2,2 0,0 1,2 2v2H3V7a2,2 0,0 1,2 -2M3,9h2v9a1,1 0,0 0,1 1h12a1,1 0,0 0,1 -1V9h2v9a3,3 0,0 1,-3 3H6a3,3 0,0 1,-3 -3zM11,10h2v2h2v2h-2v2h-2v-2H9v-2h2z"),
    History("M12,3a9,9 0,1 1,-8.5 12h2.2A7,7 0,1 0,5 10H8l-4,4 -4,-4h3a9,9 0,0 1,9 -7M11,7h2v5l3.5,2.1 -1,1.7L11,13z"),
    Trending("M3,17l6,-6 4,4 6,-7h-4V6h7v7h-2V9l-7,9 -4,-4 -5,5z"),
    Lyrics("M4.5,19h3.5l2.5,-5V5h-7v9h3.5zM14,19h3.5l2.5,-5V5h-7v9h3.5z"),
    Volume("M3,9h4l5,-4v14l-5,-4H3zM15,8c2,2 2,6 0,8l1.4,1.4c3,-3 3,-7.8 0,-10.8z"),
    ;

    val vector: ImageVector by lazy {
        ImageVector.Builder(name, 24.dp, 24.dp, 24f, 24f).apply {
            addPath(PathParser().parsePathString(path).toNodes(), fill = SolidColor(Color.Black))
        }.build()
    }
}
