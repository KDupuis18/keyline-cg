import Foundation

enum MuscleGroup: String, CaseIterable, Identifiable {
    case chest = "Chest", back = "Back", shoulders = "Shoulders", biceps = "Biceps", triceps = "Triceps"
    case quads = "Quads", hamstrings = "Hamstrings", glutes = "Glutes", calves = "Calves"
    case core = "Core", fullBody = "Full Body", cardio = "Cardio"
    var id: String { rawValue }
}

enum GearType: String, CaseIterable, Identifiable {
    case barbell = "Barbell", dumbbell = "Dumbbell", machine = "Machine", cable = "Cable"
    case kettlebell = "Kettlebell", band = "Band", bodyweight = "Bodyweight", other = "Other"
    var id: String { rawValue }
}

struct ExerciseInfo: Identifiable, Hashable {
    let name: String
    let primary: MuscleGroup
    let secondary: [MuscleGroup]
    let gear: GearType
    let isCompound: Bool
    let cues: [String]

    var id: String { name }

    var isLowerBody: Bool {
        [.quads, .hamstrings, .glutes, .calves].contains(primary)
    }
}

enum ExerciseCatalog {
    static func info(named name: String) -> ExerciseInfo? {
        let key = name.lowercased()
        if let exact = byName[key] { return exact }
        // Fuzzy: catalog name contained in the logged name, longest match wins.
        return all
            .filter { key.contains($0.name.lowercased()) }
            .max { $0.name.count < $1.name.count }
    }

    /// Whether a (possibly unknown) exercise works the lower body; used for progression increments.
    static func isLowerBody(_ name: String) -> Bool {
        if let info = info(named: name) { return info.isLowerBody }
        let n = name.lowercased()
        return ["squat", "deadlift", "lunge", "leg", "hip", "rdl", "glute", "calf", "step-up", "split"]
            .contains { n.contains($0) }
    }

    static func isCompound(_ name: String) -> Bool {
        if let info = info(named: name) { return info.isCompound }
        let n = name.lowercased()
        return ["squat", "deadlift", "press", "row", "pull-up", "chin-up", "dip", "lunge", "clean", "thrust"]
            .contains { n.contains($0) }
    }

    private static let byName: [String: ExerciseInfo] = Dictionary(
        all.map { ($0.name.lowercased(), $0) }, uniquingKeysWith: { a, _ in a }
    )

    private static func e(_ name: String, _ primary: MuscleGroup, _ secondary: [MuscleGroup], _ gear: GearType,
                          compound: Bool, _ cues: String...) -> ExerciseInfo {
        ExerciseInfo(name: name, primary: primary, secondary: secondary, gear: gear, isCompound: compound, cues: cues)
    }

    static let all: [ExerciseInfo] = [
        // Squats & legs
        e("Back Squat", .quads, [.glutes, .core], .barbell, compound: true,
          "Bar on upper back, brace your core hard.", "Sit down and back between your hips; knees track over toes.", "Drive up through mid-foot, chest stays tall."),
        e("Front Squat", .quads, [.glutes, .core], .barbell, compound: true,
          "Bar rests on front delts, elbows high.", "Stay upright and sit straight down.", "Keep elbows up as you drive out of the hole."),
        e("Goblet Squat", .quads, [.glutes, .core], .dumbbell, compound: true,
          "Hold the weight at your chest.", "Push knees out and sit between your heels.", "Keep the chest proud the whole rep."),
        e("Hack Squat", .quads, [.glutes], .machine, compound: true,
          "Feet shoulder-width, mid-platform.", "Lower until thighs pass parallel.", "Press through the whole foot."),
        e("Leg Press", .quads, [.glutes, .hamstrings], .machine, compound: true,
          "Lower back stays flat on the pad.", "Lower until knees reach ~90°.", "Don't lock knees out hard at the top."),
        e("Bulgarian Split Squat", .quads, [.glutes], .dumbbell, compound: true,
          "Rear foot on a bench, front foot far enough forward.", "Drop the back knee straight down.", "Drive through the front heel."),
        e("Walking Lunge", .quads, [.glutes, .hamstrings], .dumbbell, compound: true,
          "Long controlled steps.", "Back knee kisses the floor.", "Stay tall; don't lean over the front knee."),
        e("Reverse Lunge", .quads, [.glutes], .bodyweight, compound: true,
          "Step back, not forward, to spare the knees.", "Both knees ~90° at the bottom.", "Push through the front foot to return."),
        e("Step-Up", .quads, [.glutes], .dumbbell, compound: true,
          "Whole foot on the box.", "Drive up with the top leg, not by pushing off the floor.", "Control the step down."),
        e("Leg Extension", .quads, [], .machine, compound: false,
          "Pad on the lower shin.", "Squeeze quads at the top for a beat.", "Lower slowly."),
        e("Pistol Squat", .quads, [.glutes, .core], .bodyweight, compound: true,
          "Use a box or support to start.", "Sit back on one leg, other leg forward.", "Keep the heel down."),

        // Hinge & posterior chain
        e("Deadlift", .hamstrings, [.glutes, .back, .core], .barbell, compound: true,
          "Bar over mid-foot, shins close.", "Brace, pull the slack out, then push the floor away.", "Lock out with glutes, don't lean back."),
        e("Romanian Deadlift", .hamstrings, [.glutes, .back], .barbell, compound: true,
          "Soft knees, push hips straight back.", "Bar slides down the thighs.", "Stop when hamstrings are stretched, then drive hips forward."),
        e("Trap Bar Deadlift", .quads, [.glutes, .hamstrings, .back], .barbell, compound: true,
          "Stand in the center of the handle.", "Chest up, hips slightly lower than a deadlift.", "Push the floor away."),
        e("Single-Leg RDL", .hamstrings, [.glutes, .core], .dumbbell, compound: true,
          "Hinge on one leg, back leg reaches long.", "Keep hips square to the floor.", "Slow and balanced."),
        e("Hip Thrust", .glutes, [.hamstrings], .barbell, compound: true,
          "Upper back on bench, bar over hips.", "Tuck chin, drive hips to full extension.", "Pause and squeeze at the top."),
        e("Glute Bridge", .glutes, [.hamstrings], .bodyweight, compound: false,
          "Feet flat, close to your hips.", "Drive through heels.", "Squeeze glutes hard at the top."),
        e("Good Morning", .hamstrings, [.glutes, .back], .barbell, compound: true,
          "Bar on upper back, soft knees.", "Hinge until torso nears parallel.", "Keep a neutral spine throughout."),
        e("Kettlebell Swing", .glutes, [.hamstrings, .core], .kettlebell, compound: true,
          "Hike the bell back between your legs.", "Snap hips forward explosively.", "Arms are ropes; the hips do the work."),
        e("Nordic Curl", .hamstrings, [], .bodyweight, compound: false,
          "Anchor your heels.", "Lower as slowly as possible.", "Catch yourself and push back up."),
        e("Lying Leg Curl", .hamstrings, [], .machine, compound: false,
          "Hips stay pressed into the pad.", "Curl to full contraction.", "Lower under control."),
        e("Standing Calf Raise", .calves, [], .machine, compound: false,
          "Full stretch at the bottom.", "Rise onto the big toe.", "Pause at the top."),
        e("Seated Calf Raise", .calves, [], .machine, compound: false,
          "Knees under the pad.", "Full range, slow tempo.", "Pause in the stretch."),

        // Push
        e("Bench Press", .chest, [.triceps, .shoulders], .barbell, compound: true,
          "Shoulder blades pinched, slight arch.", "Lower to mid-chest, elbows ~45°.", "Drive feet into the floor and press."),
        e("Incline Bench Press", .chest, [.shoulders, .triceps], .barbell, compound: true,
          "Bench at 30–45°.", "Lower to upper chest.", "Press up and slightly back."),
        e("Dumbbell Bench Press", .chest, [.triceps, .shoulders], .dumbbell, compound: true,
          "Dumbbells over the chest, wrists stacked.", "Lower deep for a stretch.", "Press up and slightly together."),
        e("Incline Dumbbell Press", .chest, [.shoulders, .triceps], .dumbbell, compound: true,
          "Bench at 30°.", "Elbows slightly tucked.", "Control the bottom stretch."),
        e("Floor Press", .chest, [.triceps], .dumbbell, compound: true,
          "Lie on the floor, knees bent.", "Lower until triceps touch the floor.", "Pause, then press."),
        e("Machine Chest Press", .chest, [.triceps, .shoulders], .machine, compound: true,
          "Handles at mid-chest height.", "Press without shrugging.", "Slow eccentric."),
        e("Cable Fly", .chest, [.shoulders], .cable, compound: false,
          "Slight bend in the elbows.", "Hug a big tree.", "Squeeze the chest at the middle."),
        e("Dip", .chest, [.triceps, .shoulders], .bodyweight, compound: true,
          "Lean slightly forward for chest.", "Lower until shoulders are just below elbows.", "Press to lockout."),
        e("Push-Up", .chest, [.triceps, .shoulders, .core], .bodyweight, compound: true,
          "Body in a straight plank.", "Elbows ~45° from the body.", "Chest to the floor, full lockout."),
        e("Overhead Press", .shoulders, [.triceps, .core], .barbell, compound: true,
          "Squeeze glutes, brace abs.", "Press bar straight up, head moves through.", "Finish with biceps by ears."),
        e("Dumbbell Shoulder Press", .shoulders, [.triceps], .dumbbell, compound: true,
          "Dumbbells at shoulder height.", "Press up without arching.", "Lower to ear level."),
        e("Arnold Press", .shoulders, [.triceps], .dumbbell, compound: true,
          "Start palms facing you.", "Rotate as you press.", "Reverse the rotation on the way down."),
        e("Landmine Press", .shoulders, [.chest, .triceps], .barbell, compound: true,
          "Stagger stance, bar at shoulder.", "Press up and forward.", "Shoulder-friendly angle."),
        e("Pike Push-Up", .shoulders, [.triceps], .bodyweight, compound: true,
          "Hips high, body in an upside-down V.", "Lower the head between the hands.", "Press back up."),
        e("Lateral Raise", .shoulders, [], .dumbbell, compound: false,
          "Slight lean forward.", "Lead with the elbows.", "Stop at shoulder height."),
        e("Face Pull", .shoulders, [.back], .cable, compound: false,
          "Rope at face height.", "Pull to forehead, elbows high.", "Externally rotate at the end."),
        e("Triceps Pushdown", .triceps, [], .cable, compound: false,
          "Elbows pinned to your sides.", "Fully lock out.", "Control the return."),
        e("Skull Crusher", .triceps, [], .barbell, compound: false,
          "Lower the bar toward your forehead.", "Elbows stay pointed up.", "Extend fully."),
        e("Overhead Triceps Extension", .triceps, [], .dumbbell, compound: false,
          "Weight behind your head.", "Elbows point forward.", "Big stretch at the bottom."),
        e("Close-Grip Bench Press", .triceps, [.chest], .barbell, compound: true,
          "Hands shoulder-width.", "Elbows tucked.", "Touch lower chest."),
        e("Diamond Push-Up", .triceps, [.chest], .bodyweight, compound: true,
          "Hands together under your chest.", "Elbows tight.", "Full range."),

        // Pull
        e("Pull-Up", .back, [.biceps], .bodyweight, compound: true,
          "Start from a dead hang.", "Drive elbows down to your ribs.", "Chin over the bar."),
        e("Chin-Up", .back, [.biceps], .bodyweight, compound: true,
          "Palms facing you, shoulder-width.", "Pull chest toward the bar.", "Lower all the way."),
        e("Lat Pulldown", .back, [.biceps], .cable, compound: true,
          "Slight lean back.", "Pull the bar to your upper chest.", "Squeeze lats; control up."),
        e("Barbell Row", .back, [.biceps, .hamstrings], .barbell, compound: true,
          "Hinge to ~45°, flat back.", "Row to the lower ribs.", "No body English."),
        e("Dumbbell Row", .back, [.biceps], .dumbbell, compound: true,
          "Support on a bench.", "Pull elbow toward your hip.", "Full stretch at the bottom."),
        e("Chest-Supported Row", .back, [.biceps], .dumbbell, compound: true,
          "Chest on an incline bench.", "Squeeze shoulder blades together.", "Pause at the top."),
        e("Seated Cable Row", .back, [.biceps], .cable, compound: true,
          "Sit tall.", "Row to your belly button.", "Let shoulders reach forward on the stretch."),
        e("Inverted Row", .back, [.biceps, .core], .bodyweight, compound: true,
          "Body straight under a bar or rings.", "Pull chest to the bar.", "Squeeze glutes to stay rigid."),
        e("Pullover", .back, [.chest], .dumbbell, compound: false,
          "Lie across a bench.", "Lower the weight behind your head with soft elbows.", "Pull back over the chest."),
        e("Rear Delt Fly", .shoulders, [.back], .dumbbell, compound: false,
          "Hinge forward.", "Raise arms out wide.", "Squeeze the upper back."),
        e("Barbell Curl", .biceps, [], .barbell, compound: false,
          "Elbows at your sides.", "Curl without swinging.", "Lower slowly."),
        e("Dumbbell Curl", .biceps, [], .dumbbell, compound: false,
          "Supinate as you curl.", "Squeeze at the top.", "Full extension at the bottom."),
        e("Hammer Curl", .biceps, [], .dumbbell, compound: false,
          "Neutral grip.", "Elbows still.", "Control down."),
        e("Incline Dumbbell Curl", .biceps, [], .dumbbell, compound: false,
          "Lie back on a 45° bench.", "Let arms hang behind you.", "Curl without moving elbows."),
        e("Cable Curl", .biceps, [], .cable, compound: false,
          "Constant tension.", "Elbows pinned.", "Squeeze at the top."),

        // Core
        e("Plank", .core, [], .bodyweight, compound: false,
          "Elbows under shoulders.", "Squeeze glutes and quads.", "Don't let hips sag."),
        e("Side Plank", .core, [], .bodyweight, compound: false,
          "Stack feet or stagger them.", "Hips high.", "Breathe."),
        e("Dead Bug", .core, [], .bodyweight, compound: false,
          "Low back pressed into the floor.", "Extend opposite arm and leg.", "Move slowly."),
        e("Hanging Knee Raise", .core, [], .bodyweight, compound: false,
          "Dead hang, no swinging.", "Curl the pelvis up.", "Lower slowly."),
        e("Pallof Press", .core, [], .cable, compound: false,
          "Stand side-on to the anchor.", "Press straight out and resist rotation.", "Hold 2 seconds."),
        e("Ab Wheel Rollout", .core, [.shoulders], .other, compound: false,
          "Start on knees.", "Roll out with a hollow body.", "Pull back with the abs."),
        e("Russian Twist", .core, [], .bodyweight, compound: false,
          "Lean back slightly.", "Rotate from the ribs.", "Control each side."),

        // Power & conditioning
        e("Box Jump", .quads, [.glutes, .calves], .other, compound: true,
          "Swing arms and jump explosively.", "Land softly in a quarter squat.", "Step down; don't jump down."),
        e("Broad Jump", .glutes, [.quads, .hamstrings], .bodyweight, compound: true,
          "Load hips back.", "Jump as far as you can.", "Stick the landing."),
        e("Depth Jump", .quads, [.calves, .glutes], .other, compound: true,
          "Step off a low box.", "Minimize ground contact time.", "Rebound as high as possible."),
        e("Medicine Ball Slam", .fullBody, [.core, .shoulders], .other, compound: true,
          "Reach tall.", "Slam with your whole body.", "Catch and repeat."),
        e("Power Clean", .fullBody, [.back, .quads], .barbell, compound: true,
          "Start like a deadlift.", "Explode through the hips and shrug.", "Catch in a front rack."),
        e("Burpee", .fullBody, [.chest, .quads], .bodyweight, compound: true,
          "Hands down, jump back.", "Chest to floor.", "Jump up and clap overhead."),
        e("Farmer's Carry", .fullBody, [.core, .back], .dumbbell, compound: true,
          "Heavy weights at your sides.", "Walk tall with short steps.", "Don't let them swing."),
        e("Sled Push", .fullBody, [.quads, .glutes], .other, compound: true,
          "Low body angle.", "Drive with short, powerful steps.", "Arms locked."),
        e("Rowing Machine", .cardio, [.back, .quads], .machine, compound: true,
          "Legs, hips, then arms.", "Reverse on the return.", "Smooth, powerful strokes."),
        e("Assault Bike", .cardio, [.quads], .machine, compound: true,
          "Push and pull the handles.", "Stay seated.", "Pace intervals honestly."),
        e("Jump Rope", .cardio, [.calves], .other, compound: false,
          "Small bounces.", "Turn the rope with the wrists.", "Stay on the balls of your feet."),
        e("Easy Run", .cardio, [.quads, .calves], .bodyweight, compound: true,
          "Conversational pace.", "Relaxed shoulders.", "Short, quick steps."),
        e("Interval Run", .cardio, [.quads, .calves], .bodyweight, compound: true,
          "Fast but controlled.", "Keep form as you fatigue.", "Recover fully between reps."),
        e("Tempo Run", .cardio, [.quads, .calves], .bodyweight, compound: true,
          "Comfortably hard.", "Steady effort.", "Breathe rhythmically."),
    ]
}
